import { customFetch } from "./custom-fetch";

export interface AbsentMember {
  userId: string;
  name: string;
  phone: string;
  membershipNumber: string | null;
  memberSubscriptionId: number;
  startDate: string;
  endDate: string;
  /** ISO timestamp of the user's most recent CheckIn, or null if never. */
  lastCheckinAt: string | null;
  /** Whole days since the last check-in (or since join date if never). */
  daysAbsent: number;
  /** ISO timestamp of the last `whatsapp`-channel reminder in the last 24h. */
  lastReminderAt: string | null;
}

export interface AbsenceReminderLog {
  id: number;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  channel: "whatsapp" | "system";
  sentBy: string | null;
  success: boolean;
  note: string | null;
  sentAt: string;
}

export interface AbsenceRunSummary {
  candidates: number;
  logged: number;
  skipped: number;
  message: string;
}

export const getAbsentMembers = (days = 3) =>
  customFetch<{ days: number; items: AbsentMember[] }>(`/api/absence-reminders/absent?days=${days}`, {
    method: "GET",
  });

export const getAbsenceReminderLog = (limit = 200) =>
  customFetch<AbsenceReminderLog[]>(`/api/absence-reminders?limit=${limit}`, { method: "GET" });

export interface LogAbsenceReminderInput {
  userId: string;
  channel?: "whatsapp" | "system";
  success?: boolean;
  note?: string;
}

export const logAbsenceReminder = (input: LogAbsenceReminderInput) =>
  customFetch<AbsenceReminderLog>("/api/absence-reminders", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const bulkLogAbsenceReminders = (userIds: string[], note?: string) =>
  customFetch<{ insertedCount: number }>("/api/absence-reminders/bulk-log", {
    method: "POST",
    body: JSON.stringify({ userIds, note }),
  });

export const runAbsenceRemindersNow = () =>
  customFetch<AbsenceRunSummary>("/api/absence-reminders/run-now", { method: "POST" });
