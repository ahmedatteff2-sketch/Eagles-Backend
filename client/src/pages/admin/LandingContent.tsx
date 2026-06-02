import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  LandingContent,
  LandingPricingPlan,
  getLandingContent,
  updateLandingContent,
} from "@/api-client/landing-content";

const GOLD = "hsl(40 65% 52%)";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const TARGET_MAX_DIM = 1600;
const JPEG_QUALITY = 0.85;

async function downscaleImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode-failed"));
      el.src = objectUrl;
    });
    let { width, height } = img;
    if (width > TARGET_MAX_DIM || height > TARGET_MAX_DIM) {
      const ratio = Math.min(TARGET_MAX_DIM / width, TARGET_MAX_DIM / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-unavailable");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const EMPTY_PLAN: LandingPricingPlan = {
  badge: "",
  price: "",
  period: "شهر",
  features: [],
  highlighted: false,
  image: "",
};

const inputCls =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-xs font-semibold text-muted-foreground mb-1";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

export default function AdminLandingContent() {
  const { toast } = useToast();
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLandingContent()
      .then(setContent)
      .catch(() => toast({ title: "خطأ في تحميل المحتوى", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  async function pickImage(onDone: (dataUrl: string) => void, file?: File) {
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      toast({ title: "نوع ملف غير مدعوم (JPEG/PNG/WebP)", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "الصورة كبيرة جداً (الحد 5MB)", variant: "destructive" });
      return;
    }
    try {
      onDone(await downscaleImage(file));
    } catch {
      toast({ title: "تعذّرت معالجة الصورة", variant: "destructive" });
    }
  }

  async function handleSave() {
    if (!content) return;
    setSaving(true);
    try {
      const saved = await updateLandingContent(content);
      setContent(saved);
      toast({ title: "تم حفظ محتوى اللاندينج" });
    } catch {
      toast({ title: "خطأ أثناء الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !content) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const updatePlan = (idx: number, patch: Partial<LandingPricingPlan>) =>
    setContent((c) =>
      c
        ? {
            ...c,
            pricing: {
              plans: c.pricing.plans.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
            },
          }
        : c,
    );

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">محتوى اللاندينج</h1>
          <p className="text-muted-foreground text-sm">تحكّم في محتوى الصفحة الرئيسية العامة للزوار</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60"
          style={{ backgroundColor: GOLD }}
        >
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>

      {/* Hero */}
      <Section title="القسم الرئيسي (Hero)">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>العنوان (سطر أول)</label>
            <input
              className={inputCls}
              value={content.hero.headingTop}
              onChange={(e) =>
                setContent({ ...content, hero: { ...content.hero, headingTop: e.target.value } })
              }
            />
          </div>
          <div>
            <label className={labelCls}>العنوان (سطر ثاني)</label>
            <input
              className={inputCls}
              value={content.hero.headingBottom}
              onChange={(e) =>
                setContent({ ...content, hero: { ...content.hero, headingBottom: e.target.value } })
              }
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>نص الزر</label>
          <input
            className={inputCls}
            value={content.hero.ctaText}
            onChange={(e) => setContent({ ...content, hero: { ...content.hero, ctaText: e.target.value } })}
          />
        </div>
        <div>
          <label className={labelCls}>صورة الخلفية</label>
          <div className="flex items-center gap-3">
            {content.hero.backgroundImage ? (
              <img
                src={content.hero.backgroundImage}
                alt=""
                className="h-16 w-28 rounded object-cover border border-card-border"
              />
            ) : null}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-xs text-muted-foreground"
              onChange={(e) =>
                pickImage(
                  (dataUrl) =>
                    setContent((c) => (c ? { ...c, hero: { ...c.hero, backgroundImage: dataUrl } } : c)),
                  e.target.files?.[0],
                )
              }
            />
            {content.hero.backgroundImage ? (
              <button
                type="button"
                className="text-xs text-red-500"
                onClick={() => setContent({ ...content, hero: { ...content.hero, backgroundImage: "" } })}
              >
                إزالة
              </button>
            ) : null}
          </div>
        </div>
      </Section>

      {/* About */}
      <Section title="من نحن">
        <div>
          <label className={labelCls}>العنوان</label>
          <input
            className={inputCls}
            value={content.about.heading}
            onChange={(e) => setContent({ ...content, about: { ...content.about, heading: e.target.value } })}
          />
        </div>
        <div>
          <label className={labelCls}>الوصف</label>
          <textarea
            className={`${inputCls} min-h-24`}
            value={content.about.paragraph}
            onChange={(e) =>
              setContent({ ...content, about: { ...content.about, paragraph: e.target.value } })
            }
          />
        </div>
      </Section>

      {/* Pricing */}
      <Section title="الباقات والأسعار">
        <div className="space-y-4">
          {content.pricing.plans.map((plan, idx) => (
            <div key={idx} className="rounded-lg border border-card-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">باقة {idx + 1}</span>
                <button
                  type="button"
                  className="text-xs text-red-500"
                  onClick={() =>
                    setContent({
                      ...content,
                      pricing: { plans: content.pricing.plans.filter((_, i) => i !== idx) },
                    })
                  }
                >
                  حذف الباقة
                </button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>الاسم</label>
                  <input
                    className={inputCls}
                    value={plan.badge}
                    onChange={(e) => updatePlan(idx, { badge: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>السعر</label>
                  <input
                    className={inputCls}
                    value={plan.price}
                    onChange={(e) => updatePlan(idx, { price: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>المدة</label>
                  <input
                    className={inputCls}
                    value={plan.period}
                    onChange={(e) => updatePlan(idx, { period: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>المميزات (سطر لكل ميزة)</label>
                <textarea
                  className={`${inputCls} min-h-24`}
                  value={plan.features.join("\n")}
                  onChange={(e) =>
                    updatePlan(idx, {
                      features: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={plan.highlighted}
                    onChange={(e) => updatePlan(idx, { highlighted: e.target.checked })}
                  />
                  باقة مميزة ⭐
                </label>
                <div className="flex items-center gap-2">
                  {plan.image ? (
                    <img
                      src={plan.image}
                      alt=""
                      className="h-12 w-16 rounded object-cover border border-card-border"
                    />
                  ) : null}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="text-xs text-muted-foreground"
                    onChange={(e) =>
                      pickImage((dataUrl) => updatePlan(idx, { image: dataUrl }), e.target.files?.[0])
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="rounded-lg border border-dashed border-card-border w-full py-2.5 text-sm text-muted-foreground hover:text-foreground"
            onClick={() =>
              setContent({
                ...content,
                pricing: { plans: [...content.pricing.plans, { ...EMPTY_PLAN }] },
              })
            }
          >
            + إضافة باقة
          </button>
        </div>
      </Section>

      {/* Social / contact */}
      <Section title="التواصل والسوشيال ميديا">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>فيسبوك</label>
            <input
              className={inputCls}
              value={content.social.facebook}
              onChange={(e) =>
                setContent({ ...content, social: { ...content.social, facebook: e.target.value } })
              }
            />
          </div>
          <div>
            <label className={labelCls}>إنستجرام</label>
            <input
              className={inputCls}
              value={content.social.instagram}
              onChange={(e) =>
                setContent({ ...content, social: { ...content.social, instagram: e.target.value } })
              }
            />
          </div>
          <div>
            <label className={labelCls}>تيك توك</label>
            <input
              className={inputCls}
              value={content.social.tiktok}
              onChange={(e) =>
                setContent({ ...content, social: { ...content.social, tiktok: e.target.value } })
              }
            />
          </div>
          <div>
            <label className={labelCls}>واتساب (رابط wa.me)</label>
            <input
              className={inputCls}
              value={content.social.whatsapp}
              onChange={(e) =>
                setContent({ ...content, social: { ...content.social, whatsapp: e.target.value } })
              }
            />
          </div>
          <div>
            <label className={labelCls}>رقم الهاتف</label>
            <input
              className={inputCls}
              value={content.social.phone}
              onChange={(e) =>
                setContent({ ...content, social: { ...content.social, phone: e.target.value } })
              }
            />
          </div>
        </div>
      </Section>

      <div className="flex justify-end pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg px-6 py-2.5 text-sm font-bold text-black disabled:opacity-60"
          style={{ backgroundColor: GOLD }}
        >
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}
