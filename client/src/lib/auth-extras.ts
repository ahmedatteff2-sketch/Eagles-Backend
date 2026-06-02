/**
 * Thin client wrappers over the new security-related endpoints. The orval
 * client is regenerated from the OpenAPI spec, but these endpoints aren't in
 * the spec yet — once they are, the wrappers below can be replaced with the
 * generated hooks.
 */
import { customFetch } from "@/api-client/custom-fetch";

export interface SessionRow {
  id: number;
  label: string | null;
  userAgent: string | null;
  ip: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export interface AuditLogRow {
  id: number;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  status: number | null;
  payload: unknown;
  createdAt: string;
}

export interface AuditLogResponse {
  rows: AuditLogRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditQueryParams {
  limit?: number;
  offset?: number;
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

export interface TrainerOption {
  id: string;
  name: string;
  phone: string;
}

export function listSessions(): Promise<SessionRow[]> {
  return customFetch<SessionRow[]>("/api/auth/sessions");
}

export function revokeSession(id: number): Promise<{ success: true }> {
  return customFetch<{ success: true }>(`/api/auth/sessions/${id}`, { method: "DELETE" });
}

export function revokeAllOtherSessions(): Promise<{ success: true; revoked: number }> {
  return customFetch<{ success: true; revoked: number }>("/api/auth/sessions/revoke-all", {
    method: "POST",
  });
}

export function setup2FA(): Promise<TwoFactorSetupResponse> {
  return customFetch<TwoFactorSetupResponse>("/api/auth/2fa/setup", { method: "POST" });
}

export function enable2FA(totpCode: string): Promise<{ success: true }> {
  return customFetch<{ success: true }>("/api/auth/2fa/enable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ totpCode }),
  });
}

export function disable2FA(password: string, totpCode: string): Promise<{ success: true }> {
  return customFetch<{ success: true }>("/api/auth/2fa/disable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, totpCode }),
  });
}

export interface Verify2FAResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; phone: string; role: "admin" | "trainer" | "member" };
}

export function verify2FA(partialToken: string, totpCode: string): Promise<Verify2FAResponse> {
  return customFetch<Verify2FAResponse>("/api/auth/2fa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partialToken, totpCode }),
  });
}

export function listAudit(params: AuditQueryParams): Promise<AuditLogResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  }
  const suffix = qs.toString();
  return customFetch<AuditLogResponse>(suffix ? `/api/audit?${suffix}` : "/api/audit");
}

export function listTrainers(): Promise<TrainerOption[]> {
  return customFetch<TrainerOption[]>("/api/trainers");
}
