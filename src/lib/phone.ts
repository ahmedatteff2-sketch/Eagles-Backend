/**
 * Strip every non-digit so "(010) 25-754947" and "01025754947" map to the
 * same canonical value. All phone storage and lookup paths must go through
 * this function — see `src/routes/auth.ts` (login/update-phone),
 * `src/routes/users.ts` (create/update), and `src/routes/imports.ts`.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
