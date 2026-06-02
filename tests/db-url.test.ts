/**
 * Unit tests for `parseDatabaseUrl`. Pure parsing — no DB connection needed.
 * The vitest global setup still requires DATABASE_URL to be set in the env
 * (it imports `src/db/index.ts`), which CI provides via the postgres service.
 */
import { describe, expect, it } from "vitest";
import { parseDatabaseUrl } from "../src/lib/db-url.js";

describe("parseDatabaseUrl", () => {
  it("parses a standards-compliant connection string", () => {
    const u = parseDatabaseUrl("postgres://user:secret@host:5432/db");
    expect(u.username).toBe("user");
    expect(decodeURIComponent(u.password)).toBe("secret");
    expect(u.hostname).toBe("host");
    expect(u.port).toBe("5432");
    expect(u.pathname).toBe("/db");
  });

  it("recovers when the password contains unencoded '/' characters", () => {
    // Mirrors a real Supabase pooler URL where the provider-issued password
    // contains slashes that the operator pasted verbatim into Render.
    const u = parseDatabaseUrl(
      "postgresql://postgres.xej:CpF3/54KTFeH/jd@aws-1-eu-central-1.pooler.supabase.com:6543/postgres",
    );
    expect(u.username).toBe("postgres.xej");
    expect(decodeURIComponent(u.password)).toBe("CpF3/54KTFeH/jd");
    expect(u.hostname).toBe("aws-1-eu-central-1.pooler.supabase.com");
    expect(u.port).toBe("6543");
    expect(u.pathname).toBe("/postgres");
  });

  it("preserves passwords that were already percent-encoded", () => {
    const u = parseDatabaseUrl("postgres://user:p%40ss@host/db");
    expect(decodeURIComponent(u.password)).toBe("p@ss");
  });

  it("splits userinfo from authority on the LAST '@'", () => {
    const u = parseDatabaseUrl("postgres://user:p@ss@host:5432/db");
    expect(u.username).toBe("user");
    expect(decodeURIComponent(u.password)).toBe("p@ss");
    expect(u.hostname).toBe("host");
    expect(u.port).toBe("5432");
  });

  it("throws a helpful error when no scheme is present", () => {
    expect(() => parseDatabaseUrl("not-a-url")).toThrow(/DATABASE_URL/);
  });

  it("throws a helpful error when password chars are still un-rescuable", () => {
    expect(() => parseDatabaseUrl("postgres://userwithoutcolonormaderror")).toThrow();
  });
});
