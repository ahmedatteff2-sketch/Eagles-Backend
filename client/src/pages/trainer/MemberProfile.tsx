/**
 * Trainer's view of a single member's profile. Tabs:
 *   - Overview: subscription, last check-ins, latest body stats
 *   - Workouts: recent exercise logs
 *   - Notes: full CRUD for trainer notes (pinning, categories, edit, delete)
 *
 * The route is `/trainer/members/:memberId`. If the member isn't assigned to
 * the calling trainer, the API returns 404; we render a friendly message
 * rather than the raw error.
 */
import { useState } from "react";
import { Link, useRoute } from "wouter";
import {
  TRAINER_NOTE_CATEGORIES,
  type TrainerNoteCategory,
  useCreateTrainerNote,
  useDeleteTrainerNote,
  useTrainerMemberProfile,
  useUpdateTrainerNote,
} from "@workspace/api-client-react";

type Tab = "overview" | "workouts" | "notes";

export default function TrainerMemberProfile() {
  const [, params] = useRoute("/trainer/members/:id");
  const memberId = params?.id ?? null;
  const { data, isLoading, isError, error } = useTrainerMemberProfile(memberId);
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <div className="h-24 rounded-2xl bg-[hsl(0_0%_9%)] animate-pulse" />
        <div className="h-64 rounded-2xl bg-[hsl(0_0%_9%)] animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    const status = (error as { status?: number } | undefined)?.status;
    const isNotFound = status === 404;
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-3">
        <p className="text-sm text-[hsl(0_72%_70%)]">
          {isNotFound ? "العضو غير موجود أو غير مخصص لك." : "تعذّر تحميل ملف العضو."}
        </p>
        <Link href="/trainer/members">
          <span className="inline-block text-xs text-[hsl(40_65%_55%)] cursor-pointer">
            ← الرجوع إلى أعضائي
          </span>
        </Link>
      </div>
    );
  }

  const sub = data.currentSubscription;
  const today = new Date().toISOString().split("T")[0];
  const isActive = sub && sub.status === "active" && sub.endDate >= today;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header card */}
      <div className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))",
            color: "hsl(40 65% 70%)",
            border: "2px solid hsl(40 65% 40% / 0.4)",
          }}
        >
          {data.member.name?.[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-[hsl(40_20%_88%)] truncate">{data.member.name}</h1>
          <p className="text-xs text-[hsl(0_0%_50%)]">
            {data.member.phone}
            {data.member.membershipNumber ? ` • ${data.member.membershipNumber}` : ""}
          </p>
          {sub && (
            <p className="text-xs mt-1">
              <span className="text-[hsl(0_0%_50%)]">اشتراك {sub.plan} حتى </span>
              <span style={{ color: isActive ? "hsl(142 60% 65%)" : "hsl(0 60% 65%)" }}>{sub.endDate}</span>
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[hsl(0_0%_14%)]">
        {(
          [
            { key: "overview", label: "نظرة عامة" },
            { key: "workouts", label: "آخر التمارين" },
            { key: "notes", label: `الملاحظات (${data.notes.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: tab === t.key ? "hsl(40 65% 52%)" : "transparent",
              color: tab === t.key ? "hsl(40 65% 60%)" : "hsl(0 0% 50%)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "workouts" && <WorkoutsTab logs={data.recentExerciseLogs} />}
      {tab === "notes" && <NotesTab memberId={data.member.id} notes={data.notes} />}
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: NonNullable<ReturnType<typeof useTrainerMemberProfile>["data"]> }) {
  const body = data.latestBodyStats;
  return (
    <div className="space-y-3">
      {/* Latest body stats */}
      <section className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
        <h2 className="text-sm font-bold text-[hsl(40_20%_85%)] mb-3">آخر القياسات</h2>
        {!body ? (
          <p className="text-xs text-[hsl(0_0%_50%)]">لم يسجّل العضو أي قياسات بعد.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="الوزن" value={body.weight ? `${body.weight} كجم` : "—"} />
            <Stat label="نسبة الدهون" value={body.bodyFat ? `${body.bodyFat}%` : "—"} />
            <Stat label="التاريخ" value={body.date} />
          </div>
        )}
      </section>

      {/* Last check-ins */}
      <section className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
        <h2 className="text-sm font-bold text-[hsl(40_20%_85%)] mb-3">آخر مرات الحضور</h2>
        {data.recentCheckins.length === 0 ? (
          <p className="text-xs text-[hsl(0_0%_50%)]">لم يحضر بعد.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.recentCheckins.slice(0, 10).map((c) => (
              <li
                key={c.id}
                className="text-xs flex items-center justify-between px-2 py-1.5 rounded-lg bg-[hsl(0_0%_7%)]"
              >
                <span className="text-[hsl(40_20%_82%)]">
                  {new Date(c.timestamp).toLocaleString("ar-EG")}
                </span>
                <span className="text-[hsl(0_0%_45%)]">{c.method}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[hsl(0_0%_50%)]">{label}</p>
      <p className="text-base font-bold text-[hsl(40_20%_88%)] mt-0.5">{value}</p>
    </div>
  );
}

// ── Workouts ────────────────────────────────────────────────────────────────

interface ExerciseLog {
  id: number;
  date: string;
  exerciseId: number;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: string;
}

function WorkoutsTab({ logs }: { logs: ExerciseLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] text-center text-sm text-[hsl(0_0%_50%)]">
        لم يسجّل العضو أي تمارين بعد.
      </div>
    );
  }

  // Group by (date, exerciseName) so a "day's session" reads cleanly.
  const groups = new Map<string, ExerciseLog[]>();
  for (const log of logs) {
    const key = `${log.date}|${log.exerciseName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log);
  }

  return (
    <div className="space-y-2">
      {Array.from(groups.entries()).map(([key, sets]) => {
        const [date, name] = key.split("|");
        return (
          <div key={key} className="rounded-2xl p-3 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[hsl(40_20%_88%)]">{name}</p>
              <p className="text-[11px] text-[hsl(0_0%_45%)]">{date}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sets
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((s) => (
                  <span
                    key={s.id}
                    className="text-xs px-2 py-1 rounded-md bg-[hsl(0_0%_7%)] text-[hsl(40_20%_80%)]"
                  >
                    {s.reps} × {Number(s.weight).toFixed(1)} كجم
                  </span>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Notes ───────────────────────────────────────────────────────────────────

interface Note {
  id: number;
  note: string;
  category: string;
  pinned: boolean;
  trainerId: string | null;
  createdAt: string;
}

function NotesTab({ memberId, notes }: { memberId: string; notes: Note[] }) {
  const create = useCreateTrainerNote();
  const update = useUpdateTrainerNote();
  const del = useDeleteTrainerNote();

  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<TrainerNoteCategory>("general");
  const [pinned, setPinned] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  function submit() {
    const text = draft.trim();
    if (!text) return;
    create.mutate(
      { memberId, note: text, category, pinned },
      {
        onSuccess: () => {
          setDraft("");
          setPinned(false);
          setCategory("general");
        },
      },
    );
  }

  function startEdit(n: Note) {
    setEditingId(n.id);
    setEditingText(n.note);
  }

  function saveEdit(id: number) {
    const text = editingText.trim();
    if (!text) return;
    update.mutate({ noteId: id, memberId, patch: { note: text } }, { onSuccess: () => setEditingId(null) });
  }

  return (
    <div className="space-y-3">
      {/* Composer */}
      <section className="rounded-2xl p-4 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="اكتب ملاحظة سريعة... (مثال: ركبته اليمنى تؤلمه، خفّف الـ squats)"
          className="w-full px-3 py-2 rounded-xl text-sm bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_14%)] text-[hsl(40_20%_85%)] placeholder:text-[hsl(0_0%_40%)] focus:border-[hsl(40_65%_48%)] focus:outline-none resize-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TrainerNoteCategory)}
            className="px-3 py-1.5 rounded-xl text-xs bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_14%)] text-[hsl(40_20%_85%)]"
          >
            {TRAINER_NOTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {translateCategory(c)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-[hsl(40_20%_80%)] cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            تثبيت
          </label>
          <div className="flex-1" />
          <button
            onClick={submit}
            disabled={!draft.trim() || create.isPending}
            className="px-4 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed text-[hsl(0_0%_5%)] bg-gradient-to-br from-[hsl(40_65%_52%)] to-[hsl(40_65%_40%)]"
          >
            {create.isPending ? "..." : "إضافة"}
          </button>
        </div>
        {create.isError && (
          <p className="text-xs text-[hsl(0_72%_70%)]">تعذّر حفظ الملاحظة. حاول مرة أخرى.</p>
        )}
      </section>

      {/* List */}
      {notes.length === 0 ? (
        <div className="p-6 rounded-2xl bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_14%)] text-center text-sm text-[hsl(0_0%_50%)]">
          لا توجد ملاحظات بعد. أضف أول ملاحظة من الأعلى.
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-2xl p-3 bg-[hsl(0_0%_9%)] border"
              style={{
                borderColor: n.pinned ? "hsl(40 65% 48% / 0.35)" : "hsl(0 0% 14%)",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {editingId === n.id ? (
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={3}
                      className="w-full px-2 py-1 rounded-lg text-sm bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_14%)] text-[hsl(40_20%_85%)] focus:border-[hsl(40_65%_48%)] focus:outline-none resize-none"
                    />
                  ) : (
                    <p className="text-sm text-[hsl(40_20%_85%)] whitespace-pre-wrap">{n.note}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[hsl(0_0%_45%)]">
                    {n.pinned && <span className="text-[hsl(40_65%_60%)]">📌 مثبّتة</span>}
                    <span>{translateCategory(n.category)}</span>
                    <span>•</span>
                    <span>{new Date(n.createdAt).toLocaleDateString("ar-EG")}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {editingId === n.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(n.id)}
                        className="text-[10px] px-2 py-1 rounded-md bg-[hsl(40_65%_48%)] text-[hsl(0_0%_5%)] font-bold"
                      >
                        حفظ
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-[10px] px-2 py-1 rounded-md text-[hsl(0_0%_50%)]"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          update.mutate({
                            noteId: n.id,
                            memberId,
                            patch: { pinned: !n.pinned },
                          })
                        }
                        className="text-[10px] px-2 py-1 rounded-md bg-[hsl(0_0%_12%)] text-[hsl(40_65%_60%)]"
                        aria-label="تثبيت"
                      >
                        {n.pinned ? "إلغاء" : "تثبيت"}
                      </button>
                      <button
                        onClick={() => startEdit(n)}
                        className="text-[10px] px-2 py-1 rounded-md bg-[hsl(0_0%_12%)] text-[hsl(0_0%_60%)]"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("احذف هذه الملاحظة؟")) {
                            del.mutate({ noteId: n.id, memberId });
                          }
                        }}
                        className="text-[10px] px-2 py-1 rounded-md bg-[hsl(0_72%_51%/0.1)] text-[hsl(0_72%_65%)]"
                      >
                        حذف
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "عام",
  form: "أداء التمرين",
  nutrition: "تغذية",
  behavior: "سلوك",
  injury: "إصابة",
};
function translateCategory(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}
