import { useAuthStore } from "@/store/auth";
import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect } from "react";

const GOLD = "hsl(40 65% 52%)";

interface Note {
  id: number;
  note: string;
  createdAt: string;
}

export default function MemberCoachNotes() {
  const { user } = useAuthStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    customFetch<Note[]>(`/api/coach-notes/${user.id}`)
      .then(d => setNotes(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">💬 ملاحظات المدرب</h1>
        <p className="text-muted-foreground text-sm">ملاحظات وتوجيهات من المدرب لك</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
              <div className="h-3 w-20 rounded bg-muted mb-2" />
              <div className="h-4 w-full rounded bg-muted mb-1" />
              <div className="h-4 w-3/4 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <p className="text-3xl mb-2">📝</p>
          <p className="text-foreground font-medium mb-1">لا توجد ملاحظات بعد</p>
          <p className="text-muted-foreground text-sm">سيضيف المدرب ملاحظات حول أدائك هنا</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="rounded-xl p-4" style={{ background: "hsl(0 0% 9%)", border: `1px solid hsl(40 65% 48% / 0.15)` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${GOLD}20` }}>
                  <span className="text-sm">💬</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString("ar-EG", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
