// Admin UID allowlist. Backed by env var so granting/revoking admin doesn't
// require a code change — just edit .env.local (or Vercel env) and redeploy.
//
// We use NEXT_PUBLIC_ADMIN_UIDS (not ADMIN_UIDS) so the list is readable from
// client components too — used by the AdminGuard. Firebase UIDs aren't
// sensitive (knowing one doesn't grant access; only a valid auth token does),
// so making them client-visible is fine.
//
// Format: NEXT_PUBLIC_ADMIN_UIDS=uid1,uid2,uid3   (comma-separated, spaces OK)

export function getAdminUids(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_UIDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdmin(uid: string | null | undefined): boolean {
  if (!uid) return false;
  return getAdminUids().includes(uid);
}
