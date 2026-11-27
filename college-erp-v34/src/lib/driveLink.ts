export interface ParsedDriveLink {
  valid: boolean;
  fileId: string | null;
  kind: 'file' | 'document' | 'spreadsheets' | 'presentation' | null;
  previewUrl: string | null;
  openUrl: string;
}

const ALLOWED_HOSTS = new Set(['drive.google.com', 'docs.google.com']);

export function parseGoogleDriveLink(rawUrl: string): ParsedDriveLink {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: false, fileId: null, kind: null, previewUrl: null, openUrl: '' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { valid: false, fileId: null, kind: null, previewUrl: null, openUrl: '' };
  }

  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return { valid: false, fileId: null, kind: null, previewUrl: null, openUrl: '' };
  }

  if (url.hostname === 'drive.google.com') {
    const fileMatch = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idParam = url.searchParams.get('id');
    // Only /open?id= and /uc?id= are file links; folderview?id= and other paths are folders.
    const idAllowed = url.pathname === '/open' || url.pathname === '/uc';
    const fileId = fileMatch?.[1] || (idAllowed && idParam && /^[a-zA-Z0-9_-]+$/.test(idParam) ? idParam : null);
    if (fileId && fileId.length >= 10) {
      return {
        valid: true,
        fileId,
        kind: 'file',
        previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        openUrl: `https://drive.google.com/file/d/${fileId}/view`,
      };
    }
  }

  if (url.hostname === 'docs.google.com') {
    const docMatch = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) {
      const kind = docMatch[1] as 'document' | 'spreadsheets' | 'presentation';
      const fileId = docMatch[2];
      return {
        valid: true,
        fileId,
        kind,
        previewUrl: `https://docs.google.com/${kind}/d/${fileId}/preview`,
        openUrl: `https://docs.google.com/${kind}/d/${fileId}/edit`,
      };
    }
  }

  return { valid: false, fileId: null, kind: null, previewUrl: null, openUrl: '' };
}