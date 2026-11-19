// Stores only SHA-256 digests (no plaintext password in client source).
// For production, Supabase Auth verifies passwords server-side with bcrypt.

const ADMIN_EMAIL_SHA256 = 'abae27faaa42bc9530bd24145a94529f67892d41052f07c1b6a47e36abfc67e9';
const ADMIN_PASS_SHA256 = 'df6584fe3b555423a18377f5c270767ddabc98950de0d16d0485b5d37b3a8a99';

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isConfiguredAdminEmail(email: string): Promise<boolean> {
  const hash = await sha256Hex(email.trim().toLowerCase());
  return hash === ADMIN_EMAIL_SHA256;
}

export async function verifyEncryptedAdmin(email: string, password: string): Promise<boolean> {
  const [emailHash, passHash] = await Promise.all([
    sha256Hex(email.trim().toLowerCase()),
    sha256Hex(password),
  ]);
  return emailHash === ADMIN_EMAIL_SHA256 && passHash === ADMIN_PASS_SHA256;
}
