import { customFetch } from "./custom-fetch";

export interface ExpiringMember {
  memberSubscriptionId: number;
  userId: string;
  name: string;
  phone: string;
  membershipNumber: string | null;
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "frozen";
  subName: string;
  daysLeft: number;
  lastReminderAt: string | null;
}

export interface RenewalReminderLog {
  id: number;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  memberSubscriptionId: number | null;
  channel: "whatsapp" | "system";
  sentBy: string | null;
  success: boolean;
  note: string | null;
  sentAt: string;
}

export interface RenewalRunSummary {
  candidates: number;
  logged: number;
  skipped: number;
  message: string;
}

export const getExpiringMembers = (days = 3) =>
  customFetch<{ days: number; items: ExpiringMember[] }>(
    `/api/renewal-reminders/expiring?days=${days}`,
    { method: "GET" },
  );

export const getRenewalReminderLog = (limit = 200) =>
  customFetch<RenewalReminderLog[]>(
    `/api/renewal-reminders?limit=${limit}`,
    { method: "GET" },
  );

export interface LogRenewalReminderInput {
  userId: string;
  memberSubscriptionId?: number;
  channel?: "whatsapp" | "system";
  success?: boolean;
  note?: string;
}

export const logRenewalReminder = (input: LogRenewalReminderInput) =>
  customFetch<RenewalReminderLog>("/api/renewal-reminders", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const bulkLogRenewalReminders = (userIds: string[], note?: string) =>
  customFetch<{ insertedCount: number }>(
    "/api/renewal-reminders/bulk-log",
    { method: "POST", body: JSON.stringify({ userIds, note }) },
  );

export const runRenewalRemindersNow = () =>
  customFetch<RenewalRunSummary>(
    "/api/renewal-reminders/run-now",
    { method: "POST" },
  );
