import { customFetch } from "./custom-fetch";

export interface WaTemplate {
  id: number;
  name: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type WaTemplateInput = {
  name: string;
  body: string;
  enabled?: boolean;
  sortOrder?: number;
};

export const getWaTemplates = () => customFetch<WaTemplate[]>("/api/wa-templates", { method: "GET" });

export const createWaTemplate = (data: WaTemplateInput) =>
  customFetch<WaTemplate>("/api/wa-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateWaTemplate = (id: number, data: Partial<WaTemplateInput>) =>
  customFetch<WaTemplate>(`/api/wa-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteWaTemplate = (id: number) =>
  customFetch<{ success: boolean; message: string }>(`/api/wa-templates/${id}`, {
    method: "DELETE",
  });

// ── Variable substitution ────────────────────────────────────────────────────
// Supported placeholders for templates. Keep in sync with the help block on the
// admin page. Adding a new placeholder here is enough for it to be substituted
// at send-time.
export interface WaTemplateVars {
  name?: string;
  phone?: string;
  membership_number?: string;
  end_date?: string;
  gym_name?: string;
}

export function applyTemplateVars(body: string, vars: WaTemplateVars): string {
  return body.replace(/\{(\w+)\}/g, (_, key) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v ?? `{${key}}`;
  });
}
