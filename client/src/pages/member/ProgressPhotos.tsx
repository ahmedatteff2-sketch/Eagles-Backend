import { useAuthStore } from "@/store/auth";
import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { safeImageSrc } from "@/lib/safe-url";

const GOLD = "hsl(40 65% 52%)";
type Category = "front" | "side" | "back";
const CATS: { key: Category; label: string }[] = [
  { key: "front", label: "أمام" },
  { key: "side", label: "جانب" },
  { key: "back", label: "خلف" },
];

// Allow only common, safe still-image MIME types. Excludes `image/svg+xml`
// because SVG can carry inline `<script>` and event handlers.
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;
// Re-encode as JPEG with this quality after downscaling to keep the data URL
// small enough for backend storage limits.
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

interface Photo {
  id: number;
  photoUrl: string;
  category: string;
  date: string;
  note: string | null;
}

export default function MemberProgressPhotos() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<Category>("front");
  const [uploading, setUploading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function fetchPhotos() {
    customFetch<Photo[]>(`/api/progress-photos?userId=${user?.id}`)
      .then(d => setPhotos(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { fetchPhotos(); }, []);

  const filtered = photos.filter(p => p.category === cat);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      toast({ title: "نوع ملف غير مدعوم (JPEG/PNG/WebP فقط)", variant: "destructive" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "الصورة كبيرة جداً (الحد 5MB)", variant: "destructive" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      // Decode + downscale + re-encode as JPEG. This both shrinks the payload
      // and strips any EXIF/metadata, which is the right behaviour for a
      // progress-photo feature.
      const dataUrl = await downscaleImage(file);
      await customFetch("/api/progress-photos", {
        method: "POST",
        body: JSON.stringify({
          photoUrl: dataUrl,
          category: cat,
          date: new Date().toISOString().split("T")[0],
        }),
      });
      toast({ title: "تم رفع الصورة" });
      fetchPhotos();
    } catch {
      toast({ title: "خطأ في الرفع", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: number) {
    try {
      await customFetch(`/api/progress-photos/${id}`, { method: "DELETE" });
      toast({ title: "تم حذف الصورة" });
      setPhotos(prev => prev.filter(p => p.id !== id));
      setSelectedPhotos(prev => prev.filter(p => p !== id));
    } catch {
      toast({ title: "خطأ", variant: "destructive" });
    }
  }

  function toggleSelect(id: number) {
    setSelectedPhotos(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  const comparePhotos = selectedPhotos.map(id => photos.find(p => p.id === id)).filter(Boolean) as Photo[];

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">صور التقدم</h1>
          <p className="text-muted-foreground text-sm">تابع تغيّر جسمك بالصور</p>
        </div>
        <button onClick={() => { setCompareMode(!compareMode); setSelectedPhotos([]); }}
          className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
            compareMode ? "text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          style={compareMode ? { background: GOLD, color: "#000" } : {}}>
          {compareMode ? "إلغاء المقارنة" : "مقارنة"}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2">
        {CATS.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              cat === c.key ? "text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={cat === c.key ? { background: GOLD, color: "#000" } : {}}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Upload button */}
      <div className="relative">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50">
          {uploading ? "جاري الرفع..." : `+ إضافة صورة ${CATS.find(c => c.key === cat)?.label}`}
        </button>
      </div>

      {/* Compare view */}
      {compareMode && selectedPhotos.length === 2 && (
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-2 text-center">المقارنة</p>
          <div className="grid grid-cols-2 gap-2">
            {comparePhotos.map(p => (
              <div key={p.id} className="text-center">
                <img src={safeImageSrc(p.photoUrl)} alt="" className="w-full rounded-lg aspect-[3/4] object-cover" />
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(p.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {compareMode && selectedPhotos.length < 2 && (
        <div className="rounded-lg px-3 py-2" style={{ background: "hsl(40 65% 48% / 0.08)", border: "1px solid hsl(40 65% 48% / 0.15)" }}>
          <p className="text-xs" style={{ color: "hsl(40 65% 60%)" }}>اختر صورتين للمقارنة</p>
        </div>
      )}

      {/* Photos grid */}
      {loading ? (
        <div className="text-center p-8"><p className="text-muted-foreground text-sm">جاري التحميل...</p></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">📷</div>
          <p className="text-foreground font-medium mb-1">لا توجد صور بعد</p>
          <p className="text-muted-foreground text-sm">ارفع أول صورة لمتابعة تطورك</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map(p => {
            const isSelected = selectedPhotos.includes(p.id);
            return (
              <div key={p.id} className="relative group rounded-xl overflow-hidden border transition-all"
                style={{
                  borderColor: isSelected ? GOLD : "hsl(0 0% 15%)",
                  boxShadow: isSelected ? `0 0 0 2px ${GOLD}` : "none",
                }}
                onClick={() => compareMode && toggleSelect(p.id)}>
                <img src={p.photoUrl} alt="" className="w-full aspect-[3/4] object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-white font-medium">
                    {new Date(p.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                  </p>
                  {p.note && <p className="text-xs text-white/70 truncate">{p.note}</p>}
                </div>
                {!compareMode && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-3.5 h-3.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
                {compareMode && isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: GOLD }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={3} className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
