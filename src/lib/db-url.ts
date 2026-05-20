/**
 * Parse a Postgres `DATABASE_URL` into a WHATWG `URL`.
 *
 * Strict per-spec parsing (`new URL()`) requires the password to be
 * percent-encoded, but managed Postgres providers (Supabase, RDS, …) routinely
 * hand operators raw passwords containing `/`, `@`, `?`, `#`, or `:`. When
 * those characters are pasted verbatim into `DATABASE_URL`, `new URL()` throws
 * `ERR_INVALID_URL` and the process crashes on boot.
 *
 * Strategy:
 *   1. Try the strict parse first. If the URL is already well-formed, return.
 *   2. On failure, rescue by assuming the conventional
 *      `<scheme>://<user>:<password>@<authority>` shape and percent-encoding
 *      just the password substring. The userinfo/authority boundary uses the
 *      LAST `@` so passwords containing `@` are tolerated (matches `psql`).
 *   3. If the rescue still can't produce a valid URL, throw a clear error
 *      that tells the operator exactly which characters to encode.
 *
 * We deliberately avoid pulling in `pg-connection-string`: it also delegates
 * to `new URL()` internally and therefore inherits the same limitation.
 */
export function parseDatabaseUrl(raw: string): URL {
  try {
    return new URL(raw);
  } catch (initialErr) {
    const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(raw);
    if (!schemeMatch) {
      throw new Error("DATABASE_URL is not a valid URL — could not detect a URI scheme.");
    }
    const afterScheme = raw.slice(schemeMatch[0].length);
    const atIdx = afterScheme.lastIndexOf("@");
    if (atIdx < 0) {
      throw initialErr;
    }
    const userinfo = afterScheme.slice(0, atIdx);
    const authority = afterScheme.slice(atIdx + 1);
    const colonIdx = userinfo.indexOf(":");
    if (colonIdx < 0) {
      throw initialErr;
    }
    const user = userinfo.slice(0, colonIdx);
    const password = userinfo.slice(colonIdx + 1);
    const repaired = `${schemeMatch[1]}://${user}:${encodeURIComponent(password)}@${authority}`;
    try {
      return new URL(repaired);
    } catch {
      throw new Error(
        "DATABASE_URL is not a valid URL. If your password contains special " +
          "characters (e.g. '/', '@', ':', '#', '?'), URL-encode them " +
          "(e.g. '/' → '%2F', '@' → '%40').",
      );
    }
  }
}
