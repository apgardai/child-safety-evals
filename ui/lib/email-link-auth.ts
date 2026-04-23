/** localStorage key for Firebase email-link sign-in (Firebase convention). */
export const EMAIL_FOR_SIGN_IN_STORAGE_KEY = "emailForSignIn";

/**
 * Continue URL embedded in the sign-in email. Must use an origin listed under
 * Firebase Console → Authentication → Settings → Authorized domains.
 * Set NEXT_PUBLIC_SITE_URL in production if the public URL differs from window.location.origin.
 */
export function getEmailLinkActionUrl(nextPath: string): string {
  const base =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/login?next=${encodeURIComponent(nextPath)}`;
}
