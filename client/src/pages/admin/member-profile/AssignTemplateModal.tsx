import { inp } from "./helpers";

interface TemplateOption {
  id: number;
  name: string;
  exercises?: unknown[];
}

interface Props {
  memberName: string;
  templates: TemplateOption[];
  templateId: string;
  onChange: (id: string) => void;
  onAssign: () => void;
  onClose: () => void;
}

export function AssignTemplateModal({
  memberName,
  templates,
  templateId,
  onChange,
  onAssign,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-bold text-foreground mb-1">تعيين قالب تمرين</h2>
        <p className="text-muted-foreground text-sm mb-4">سيتم تعيينه لـ {memberName}</p>
        <div className="space-y-3">
          <select value={templateId} onChange={(e) => onChange(e.target.value)} className={inp}>
            <option value="">اختر قالب</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.exercises?.length ?? 0} تمرين)
              </option>
            ))}
          </select>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onAssign}
              disabled={!templateId}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                color: "hsl(0 0% 5%)",
              }}
            >
              تعيين
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
