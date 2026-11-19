// Supabase Edge Function: drive-proxy
// Streams private assignment resources & student submissions to/from Google Drive
// using a Shared Drive + Service Account (or OAuth delegation), after verifying Supabase JWT & scope.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getGoogleAccessToken(): Promise<string> {
  // Uses OAuth2 Refresh Token for the institutional Google Drive account (avoids 0GB service-account quota)
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth error: ${JSON.stringify(data)}`);
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "stream") {
      const driveFileId = url.searchParams.get("drive_file_id");
      if (!driveFileId) return new Response("Missing drive_file_id", { status: 400, headers: corsHeaders });

      // RLS on drive_files / submissions verifies user is permitted to view this file
      const { data: fileMeta, error: metaErr } = await supabase
        .from("drive_files")
        .select("drive_file_id, file_name, mime_type")
        .eq("drive_file_id", driveFileId)
        .single();

      if (metaErr || !fileMeta) {
        return new Response(JSON.stringify({ error: "Forbidden or file not found" }), { status: 403, headers: corsHeaders });
      }

      const token = await getGoogleAccessToken();
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return new Response(driveRes.body, {
        status: driveRes.status,
        headers: {
          ...corsHeaders,
          "Content-Type": fileMeta.mime_type,
          "Content-Disposition": `inline; filename="${fileMeta.file_name}"`,
        },
      });
    }

    if (req.method === "POST" && action === "upload") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const entityType = formData.get("entity_type") as string;
      const entityId = formData.get("entity_id") as string;

      if (!file || !entityType || !entityId) {
        return new Response(JSON.stringify({ error: "Missing file or metadata" }), { status: 400, headers: corsHeaders });
      }

      const token = await getGoogleAccessToken();
      const folderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID")!;
      const metadata = { name: `${entityId}_${Date.now()}_${file.name}`, parents: [folderId] };

      const multipart = new FormData();
      multipart.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      multipart.append("file", file);

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: multipart,
        }
      );

      const uploaded = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(`Drive upload failed: ${JSON.stringify(uploaded)}`);

      const { data: inserted, error: dbErr } = await supabase
        .from("drive_files")
        .insert({
          drive_file_id: uploaded.id,
          file_name: file.name,
          mime_type: file.type || "application/pdf",
          size_bytes: file.size,
          owner_user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;
      return new Response(JSON.stringify(inserted), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
