export interface ParsedDriveLink {
  valid: boolean;
  fileId: string | null;
  previewUrl: string | null;
  openUrl: string;
}

export function parseGoogleDriveLink(rawUrl: string): ParsedDriveLink {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: false, fileId: null, previewUrl: null, openUrl: '' };

  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const re of patterns) {
    const match = trimmed.match(re);
    if (match?.[1]) {
      const fileId = match[1];
      return {
        valid: true,
        fileId,
        previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        openUrl: `https://drive.google.com/file/d/${fileId}/view`,
      };
    }
  }

  return { valid: false, fileId: null, previewUrl: null, openUrl: trimmed };
}
