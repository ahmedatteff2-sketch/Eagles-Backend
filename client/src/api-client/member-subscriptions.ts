import { customFetch } from "./custom-fetch";

/**
 * Hand-written client for the freeze / bulk endpoints. The Orval-generated
 * API client (`@workspace/api-client-react`) is regenerated from the OpenAPI
 * spec, which doesn't yet describe these routes — putting the wrappers here
 * keeps callers strongly typed without forcing a spec round-trip.
 */

export interface MemberSubscription {
  id: number;
  userId: string;
  subscriptionId: number;
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "frozen";
  frozenAt: string | null;
  totalFrozenDays: number;
  createdAt: string;
}

export const freezeMemberSubscription = (id: number) =>
  customFetch<MemberSubscription>(`/api/member-subscriptions/${id}/freeze`, {
    method: "PATCH",
  });

export const unfreezeMemberSubscription = (id: number) =>
  customFetch<MemberSubscription & { addedDays: number }>(`/api/member-subscriptions/${id}/unfreeze`, {
    method: "PATCH",
  });

export const bulkExtendMemberSubscriptions = (ids: number[], days: number) =>
  customFetch<{ updatedCount: number; days: number }>("/api/member-subscriptions/bulk-extend", {
    method: "POST",
    body: JSON.stringify({ ids, days }),
  });

export const bulkFreezeMemberSubscriptions = (ids: number[]) =>
  customFetch<{ frozenCount: number }>("/api/member-subscriptions/bulk-freeze", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

export const bulkUnfreezeMemberSubscriptions = (ids: number[]) =>
  customFetch<{ unfrozenCount: number }>("/api/member-subscriptions/bulk-unfreeze", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

/**
 * Triggers a CSV download. Doesn't return parsed JSON; instead writes a Blob
 * to a hidden anchor and clicks it. We do the work here (not in the page) so
 * every caller (Members, RenewalReminders, future bulk pages) gets the same
 * filename + UTF-8-with-BOM behavior.
 */
export async function exportMemberSubscriptionsCsv(userIds: string[]): Promise<void> {
  const blob = await customFetch<Blob>("/api/member-subscriptions/export-csv", {
    method: "POST",
    body: JSON.stringify({ userIds }),
    responseType: "blob",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `members-export-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
