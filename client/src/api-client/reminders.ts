import { customFetch } from "./custom-fetch";

export interface Reminder {
  id: number;
  content: string;
  intervalMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getActiveReminders = () =>
  customFetch<Reminder[]>("/api/reminders/active", { method: "GET" });

export const getReminders = () =>
  customFetch<Reminder[]>("/api/reminders", { method: "GET" });

export const createReminder = (data: { content: string; intervalMinutes: number; isActive: boolean }) =>
  customFetch<Reminder>("/api/reminders", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateReminder = (id: number, data: Partial<{ content: string; intervalMinutes: number; isActive: boolean }>) =>
  customFetch<Reminder>(`/api/reminders/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteReminder = (id: number) =>
  customFetch<{ success: boolean; message: string }>(`/api/reminders/${id}`, { method: "DELETE" });
