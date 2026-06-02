import { GOLD } from "./helpers";

interface CoachNote {
  id: number;
  note: string;
  createdAt: string;
}

interface Props {
  notes: string;
  notesSaved: boolean;
  onNotesChange: (v: string) => void;
  onSaveNotes: () => void;
  category: string | null | undefined;
  onUpdateCategory: (cat: string) => void;
  newCoachNote: string;
  onNewCoachNoteChange: (v: string) => void;
  onSendCoachNote: () => void;
  sendingNote: boolean;
  coachNotes: CoachNote[];
  onDeleteCoachNote: (id: number) => void;
}

const CATEGORIES = [
  ["normal", "عادي", "hsl(0 0% 50%)"],
  ["vip", "VIP", "hsl(40 65% 52%)"],
  ["trial", "تجريبي", "hsl(220 70% 60%)"],
] as const;

/**
 * "Notes" tab body — admin-private scratchpad notes (localStorage),
 * member category picker, and coach notes (visible to the member).
 */
export function NotesTab({
  notes,
  notesSaved,
  onNotesChange,
  onSaveNotes,
  category,
  onUpdateCategory,
  newCoachNote,
  onNewCoachNoteChange,
  onSendCoachNote,
  sendingNote,
  coachNotes,
  onDeleteCoachNote,
}: Props) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div
        className="rounded-xl p-5"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">ملاحظات خاصة</h2>
          <button
            onClick={onSaveNotes}
            className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
            style={{
              background: notesSaved
                ? "hsl(142 60% 45%)"
                : "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
              color: "hsl(0 0% 5%)",
            }}
          >
            {notesSaved ? "✅ محفوظ" : "💾 حفظ"}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={12}
          placeholder={
            "اكتب ملاحظاتك عن العضو هنا...\nمثال:\n- إصابة في الركبة — تجنب تمارين القرفصاء\n- مستوى متقدم — يحتاج تحدي أكبر\n- يفضل التدريب الصباحي"
          }
          className="w-full resize-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed bg-transparent"
        />
        <p className="text-xs text-muted-foreground mt-3">
          💡 الملاحظات محفوظة محلياً على هذا الجهاز — مرئية للمسؤول فقط
        </p>
      </div>
      {notes && (
        <div
          className="rounded-xl p-4"
          style={{ background: "hsl(40 65% 48% / 0.06)", border: "1px solid hsl(40 65% 48% / 0.2)" }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>
            معاينة
          </p>
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{notes}</pre>
        </div>
      )}

      <div
        className="rounded-xl p-5"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
      >
        <h2 className="text-sm font-semibold text-foreground mb-3">🏷️ فئة العضو</h2>
        <div className="flex gap-2">
          {CATEGORIES.map(([val, label, color]) => (
            <button
              key={val}
              onClick={() => onUpdateCategory(val)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                category === val ? "shadow-lg" : "bg-muted text-muted-foreground"
              }`}
              style={category === val ? { background: color, color: val === "vip" ? "#000" : "#fff" } : {}}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="rounded-xl p-5"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)" }}
      >
        <h2 className="text-sm font-semibold text-foreground mb-3">
          💬 ملاحظات المدرب <span className="text-xs text-muted-foreground font-normal">(مرئية للعضو)</span>
        </h2>
        <div className="flex gap-2 mb-3">
          <input
            value={newCoachNote}
            onChange={(e) => onNewCoachNoteChange(e.target.value)}
            placeholder="اكتب ملاحظة للعضو..."
            className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => e.key === "Enter" && onSendCoachNote()}
          />
          <button
            onClick={onSendCoachNote}
            disabled={sendingNote || !newCoachNote.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: GOLD, color: "#000" }}
          >
            {sendingNote ? "..." : "إرسال"}
          </button>
        </div>
        {coachNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">لا توجد ملاحظات بعد</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {coachNotes.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2 p-2.5 rounded-lg group"
                style={{ background: "hsl(0 0% 12%)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{n.note}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleDateString("ar-EG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteCoachNote(n.id)}
                  className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
