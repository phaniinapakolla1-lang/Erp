// Supabase Edge Function: sheets-backup
// Strict ONE-WAY push of student directory data from Supabase PostgreSQL -> Google Sheets.
// Google Sheets is backup-only and never overwrites Supabase.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: students, error } = await supabase
      .from("student_profiles")
      .select(`
        roll_no, student_code, admission_year,
        profiles!inner(full_name, email, mobile, status, departments(name)),
        programs(name)
      `);

    if (error) throw error;

    const rows = [
      ["Roll No", "Student ID", "Full Name", "Email", "Mobile", "Department", "Program", "Admission Year", "Status"],
      ...(students || []).map((s: any) => [
        s.roll_no,
        s.student_code,
        s.profiles.full_name,
        s.profiles.email,
        s.profiles.mobile || "",
        s.profiles.departments?.name || "",
        s.programs?.name || "",
        String(s.admission_year),
        s.profiles.status,
      ]),
    ];

    // Obtain Google OAuth token & overwrite backup sheet range
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN")!,
        grant_type: "refresh_token",
      }),
    });
    const { access_token } = await tokenRes.json();
    const sheetId = Deno.env.get("GOOGLE_BACKUP_SHEET_ID")!;

    const sheetsRes = await fetch(
      `https://sheets.googleapis.com/v4/sheets/${sheetId}/values/Students!A1:I${rows.length}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: rows }),
      }
    );

    if (!sheetsRes.ok) {
      const errText = await sheetsRes.text();
      await supabase.from("backup_sync_logs").insert({ status: "failed", error_message: errText, records_exported: 0 });
      return new Response(JSON.stringify({ error: errText }), { status: 502, headers: corsHeaders });
    }

    await supabase.from("backup_sync_logs").insert({ status: "success", records_exported: rows.length - 1 });
    return new Response(JSON.stringify({ ok: true, exported: rows.length - 1 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
