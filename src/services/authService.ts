// ============================================================
// Auth Service
// Client-side implementation using Web Crypto API.
// SECURITY NOTE: This is a frontend-only prototype.
// In production, ALL password operations must happen server-side.
// Replace this service with API calls to your backend.
// ============================================================

export const authService = {
  // ── Crypto helpers ───────────────────────────────────────

  /** Generate a random hex string of `bytes` length */
  generateSalt(bytes = 16): string {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /** Generate a random session / device token (32 bytes = 64 hex chars) */
  generateToken(bytes = 32): string {
    return this.generateSalt(bytes);
  },

  /**
   * Hash a password with a salt using SHA-256 via Web Crypto.
   * In production: use bcrypt / Argon2 on the server.
   */
  async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray  = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
    const hash = await this.hashPassword(password, salt);
    return hash === storedHash;
  },

  // ── OTP ─────────────────────────────────────────────────

  /** Generate a 6-digit OTP code */
  generateOTP(): string {
    const arr = new Uint8Array(3);
    crypto.getRandomValues(arr);
    const num = (arr[0] * 65536 + arr[1] * 256 + arr[2]) % 1_000_000;
    return num.toString().padStart(6, '0');
  },

  // ── Device fingerprint ───────────────────────────────────

  /** Best-effort device name from user agent */
  getDeviceName(): string {
    const ua = navigator.userAgent;
    const browser =
      ua.includes('Edg/')    ? 'Edge'    :
      ua.includes('Chrome/') ? 'Chrome'  :
      ua.includes('Firefox/') ? 'Firefox' :
      ua.includes('Safari/')  ? 'Safari'  : 'Browser';

    const os =
      ua.includes('Windows') ? 'Windows' :
      ua.includes('Mac')     ? 'macOS'   :
      ua.includes('Linux')   ? 'Linux'   :
      ua.includes('Android') ? 'Android' :
      ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : 'Unknown OS';

    return `${browser} on ${os}`;
  },
};
