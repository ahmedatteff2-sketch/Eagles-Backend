/**
 * Hand-written trainer API client. The rest of the codebase uses Orval-
 * generated hooks (see ./generated), but the trainer endpoints don't have
 * an OpenAPI spec to generate from yet. Until that's set up, we wrap
 * customFetch in TanStack Query hooks here.
 *
 * The shapes mirror the service layer in src/services/trainer.service.ts
 * so a future OpenAPI-generated client can be a drop-in replacement.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ── Shared types ────────────────────────────────────────────────────────────

export interface TrainerDashboardSummary {
  totalMembers: number;
  activeMembers: number;
  expiringSoon: number;
  checkinsToday: number;
  checkinsThisWeek: number;
  averageRating: number | null;
  pinnedNotesCount: number;
}

export interface TrainerNote {
  id: number;
  trainerId: string | null;
  memberId: string;
  note: string;
  category: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerPinnedNote {
  id: number;
  note: string;
  category: string;
  createdAt: string;
  member: { id: string; name: string; phone: string };
}

export interface TrainerDashboardResponse {
  summary: TrainerDashboardSummary;
  pinnedNotes: TrainerPinnedNote[];
  recentNotes: TrainerNote[];
}

export interface TrainerMember {
  id: string;
  name: string;
  phone: string;
  membershipNumber: string | null;
  category: string;
  currentSubscription: {
    id: number;
    startDate: string;
    endDate: string;
    status: "active" | "expired" | "frozen";
    plan: string;
  } | null;
  lastCheckinAt: string | null;
}

export interface TrainerMemberProfile {
  member: {
    id: string;
    name: string;
    phone: string;
    membershipNumber: string | null;
    category: string;
    createdAt: string;
  };
  currentSubscription: TrainerMember["currentSubscription"];
  recentCheckins: Array<{ id: string; timestamp: string; method: string }>;
  recentExerciseLogs: Array<{
    id: number;
    date: string;
    exerciseId: number;
    exerciseName: string;
    setNumber: number;
    reps: number;
    weight: string;
  }>;
  latestBodyStats: { date: string; weight: string | null; bodyFat: string | null } | null;
  notes: TrainerNote[];
}

export interface TrainerScheduleSession {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  className: string;
  capacity: number | null;
  location: string | null;
}

export interface TrainerPerformance {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  retentionRate: number | null;
  averageRating: number | null;
  ratingCount: number;
  checkinsLast30d: number;
  checkinsLast7d: number;
  topMembers: Array<{ id: string; name: string; checkinsLast30d: number }>;
}

export const TRAINER_NOTE_CATEGORIES = ["general", "form", "nutrition", "behavior", "injury"] as const;
export type TrainerNoteCategory = (typeof TRAINER_NOTE_CATEGORIES)[number];

// ── Query-key factories ─────────────────────────────────────────────────────
// Centralized so invalidation in mutations stays in sync with reads.

export const trainerKeys = {
  all: ["trainer"] as const,
  dashboard: () => [...trainerKeys.all, "dashboard"] as const,
  members: () => [...trainerKeys.all, "members"] as const,
  member: (id: string) => [...trainerKeys.all, "member", id] as const,
  schedule: () => [...trainerKeys.all, "schedule"] as const,
  performance: () => [...trainerKeys.all, "performance"] as const,
};

// ── Read hooks ──────────────────────────────────────────────────────────────

export function useTrainerDashboard() {
  return useQuery({
    queryKey: trainerKeys.dashboard(),
    queryFn: () => customFetch<TrainerDashboardResponse>("/api/trainer/dashboard"),
  });
}

export function useTrainerMembers() {
  return useQuery({
    queryKey: trainerKeys.members(),
    queryFn: () =>
      customFetch<{ data: TrainerMember[]; total: number }>("/api/trainer/members"),
  });
}

export function useTrainerMemberProfile(memberId: string | null) {
  return useQuery({
    queryKey: trainerKeys.member(memberId ?? ""),
    queryFn: () => customFetch<TrainerMemberProfile>(`/api/trainer/members/${memberId}`),
    enabled: Boolean(memberId),
  });
}

export function useTrainerSchedule() {
  return useQuery({
    queryKey: trainerKeys.schedule(),
    queryFn: () =>
      customFetch<{ data: TrainerScheduleSession[] }>("/api/trainer/schedule"),
  });
}

export function useTrainerPerformance() {
  return useQuery({
    queryKey: trainerKeys.performance(),
    queryFn: () => customFetch<TrainerPerformance>("/api/trainer/performance"),
  });
}

// ── Mutation hooks ──────────────────────────────────────────────────────────

export interface CreateNoteVars {
  memberId: string;
  note: string;
  category: TrainerNoteCategory;
  pinned?: boolean;
}

export function useCreateTrainerNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, ...body }: CreateNoteVars) =>
      customFetch<TrainerNote>(`/api/trainer/members/${memberId}/notes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      // Pinned-state changes affect the dashboard widget; the member profile
      // page also lists every note. Invalidate both rather than
      // optimistic-update — the lists are small and the latency is fine.
      void qc.invalidateQueries({ queryKey: trainerKeys.dashboard() });
      void qc.invalidateQueries({ queryKey: trainerKeys.member(vars.memberId) });
    },
  });
}

export interface UpdateNoteVars {
  noteId: number;
  memberId: string; // for cache invalidation; not sent to the API
  patch: { note?: string; category?: TrainerNoteCategory; pinned?: boolean };
}

export function useUpdateTrainerNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, patch }: UpdateNoteVars) =>
      customFetch<TrainerNote>(`/api/trainer/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: trainerKeys.dashboard() });
      void qc.invalidateQueries({ queryKey: trainerKeys.member(vars.memberId) });
    },
  });
}

export interface DeleteNoteVars {
  noteId: number;
  memberId: string;
}

export function useDeleteTrainerNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId }: DeleteNoteVars) =>
      customFetch<void>(`/api/trainer/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: trainerKeys.dashboard() });
      void qc.invalidateQueries({ queryKey: trainerKeys.member(vars.memberId) });
    },
  });
}
