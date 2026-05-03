import { useState } from "react";
import {
  useListUsers, useCreateUser, useUpdateUser, useResetUserPassword,
  getListUsersQueryKey, getGetUserQueryKey,
  useListSubscriptions, useAssignSubscription, getListSubscriptionsQueryKey,
} from "../../api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const createSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  phone: z.string().min(5, "رقم الهاتف غير صالح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  role: z.enum(["member", "admin"]).default("member"),
  subscriptionId: z.coerce.number().optional(),
  startDate: z.string().optional(),
  paymentAmount: z.coerce.number().optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  phone: z.string().min(5, "رقم الهاتف غير صالح"),
  role: z.enum(["member", "admin"]).default("member"),
});
type EditForm = z.infer<typeof editSchema>;

const resetSchema = z.object({
  newPassword: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
});
type ResetForm = z.infer<typeof resetSchema>;

const WA_TEMPLATES = [
  {
    id: "welcome", label: "ترحيب بعضو جديد 👋",
    text: (name: string, endDate: string) =>
      `أهلاً وسهلاً ${name} 🦅\nيسعدنا انضمامك لعائلة Eagle Gym!\nاشتراكك فعّال حتى ${endDate}.\nنتمنى لك رحلة رياضية موفقة 💪`,
  },
  {
    id: "expiring", label: "قرب انتهاء الاشتراك ⚠️",
    text: (name: string, endDate: string) =>
      `مرحباً ${name} 👋\nاشتراكك في Eagle Gym سينتهي قريباً بتاريخ ${endDate}.\nجدد الآن واستمر في رحلتك 💪`,
  },
  {
    id: "renewal", label: "تجديد الاشتراك ✅",
    text: (name: string, endDate: string) =>
      `أهلاً ${name} 🎉\nتم تجديد اشتراكك بنجاح!\nاشتراكك الجديد فعّال حتى ${endDate}.\nأبوابنا مفتوحة لك دائماً 🦅💪`,
  },
  {
    id: "reminder", label: "تذكير بالتمرين 🏋️",
    text: (name: string, _e: string) =>
      `هيا ${name}! 💪\nجسمك ينتظرك في Eagle Gym 🦅\nلا تترك أهدافك تنتظر — نراك قريباً!`,
  },
  { id: "custom", label: "رسالة مخصصة ✏️", text: () => "" },
];

const METHOD_LABELS: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل" };
const PAGE_SIZE_OPTIONS = [10, 20, 50, 0];

const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all";
const inputSt = { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" };

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-destructive text-xs mt-1">⚠ {error}</p>}
    </div>
  );
}

function Modal({ title, sub, onClose, children, accentGreen = false }: any) {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" style={{ backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "hsl(0 0% 8%)", border: `1px solid ${accentGreen ? "rgba(37,211,102,0.25)" : "hsl(40 65% 48% / 0.2)"}` }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground" style={{ background: "hsl(0 0% 14%)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function AdminMembers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resettingUser, setResettingUser] = useState<any>(null);
  const [waUser, setWaUser] = useState<any>(null);
  const [waTemplateId, setWaTemplateId] = useState("welcome");
  const [waMsg, setWaMsg] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const qp = { search: search || undefined, page, limit: pageSize === 0 ? 1000 : pageSize };
  const { data: users, isLoading, isFetching, refetch } = useListUsers(qp, { query: { queryKey: getListUsersQueryKey(qp) } });
  const { data: subsData } = useListSubscriptions({ query: { queryKey: getListSubscriptionsQueryKey() } });

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPwd = useResetUserPassword();
  const assignSub = useAssignSubscription();

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { role: "member", startDate: new Date().toISOString().split("T")[0], paymentMethod: "cash" } });
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const selSubId = createForm.watch("subscriptionId");
  const userList: any[] = Array.isArray(users) ? users : (users as any)?.data ?? [];
  const total: number = (users as any)?.total ?? userList.length;
  const subList: any[] = Array.isArray(subsData) ? subsData : [];
  const selPlan = subList.find((s: any) => s.id === Number(selSubId));
  const totalPages = pageSize === 0 ? 1 : Math.ceil(total / pageSize);

  function getEndDate(u: any) {
    return u.currentSubscription?.endDate ? new Date(u.currentSubscription.endDate).toLocaleDateString("ar-EG") : "—";
  }

  function openWa(u: any) {
    setWaUser(u); setWaTemplateId("welcome");
    setWaMsg(WA_TEMPLATES[0].text(u.name, getEndDate(u)));
  }
  function onTplChange(id: string) {
    setWaTemplateId(id);
    if (!waUser) return;
    if (id === "custom") { setWaMsg(""); return; }
    const t = WA_TEMPLATES.find(t => t.id === id)!;
    setWaMsg(t.text(waUser.name, getEndDate(waUser)));
  }
  function sendWa() {
    if (!waUser || !waMsg.trim()) return;
    const p = waUser.phone?.replace(/\D/g, "");
    const intl = p?.startsWith("0") ? "2" + p : p;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(waMsg)}`, "_blank");
  }

  function openEdit(u: any) {
    setEditingUser(u);
    editForm.reset({ name: u.name, phone: u.phone ?? "", role: u.role ?? "member" });
  }
  function onSubmitEdit(data: EditForm) {
    if (!editingUser) return;
    updateUser.mutate({ userId: editingUser.id, data }, {
      onSuccess: () => {
        toast({ title: "✅ تم تحديث بيانات العضو" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(editingUser.id) });
        setEditingUser(null);
      },
      onError: (err: any) => toast({ title: "خطأ في التحديث", description: err?.response?.data?.message, variant: "destructive" }),
    });
  }
  function onSubmitCreate(data: CreateForm) {
    const { subscriptionId, startDate, paymentAmount, paymentMethod, ...payload } = data;
    createUser.mutate({ data: payload }, {
      onSuccess: (newUser: any) => {
        const userId = newUser?.id ?? newUser?.user?.id;
        if (subscriptionId && startDate && userId) {
          assignSub.mutate({ data: { userId, subscriptionId, startDate, ...(paymentAmount ? { paymentAmount } : {}), ...(paymentMethod ? { paymentMethod } : {}) } }, {
            onSuccess: () => toast({ title: "✅ تم إضافة العضو وتعيين الاشتراك" }),
            onError: () => toast({ title: "⚠ أُضيف العضو لكن فشل الاشتراك", variant: "destructive" }),
          });
        } else toast({ title: "✅ تم إضافة العضو" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        createForm.reset(); setShowCreate(false);
      },
      onError: (err: any) => toast({ title: "خطأ", description: err?.response?.data?.message ?? "تحقق من البيانات", variant: "destructive" }),
    });
  }
  function onSubmitReset(data: ResetForm) {
    if (!resettingUser) return;
    resetPwd.mutate({ userId: resettingUser.id, data: { newPassword: data.newPassword } }, {
      onSuccess: () => { toast({ title: "✅ تم تغيير كلمة المرور" }); resetForm.reset(); setResettingUser(null); },
      onError: () => toast({ title: "خطأ في تغيير كلمة المرور", variant: "destructive" }),
    });
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الأعضاء</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إجمالي {total} عضو</p>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{background:"hsl(40 65% 48% / 0.15)",color:"hsl(40 65% 58%)"}}>v2.1 ✓</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} title="تحديث" className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 22%)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 text-muted-foreground ${isFetching ? "animate-spin" : ""}`}>
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 5.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
          <button onClick={() => { createForm.reset(); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold"
            style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)", boxShadow: "0 4px 15px rgba(201,164,60,0.3)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            إضافة عضو
          </button>
        </div>
      </div>

      {/* Search + page size */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو رقم الهاتف..."
            className="w-full rounded-lg pr-10 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
          <span>عرض:</span>
          <div className="flex gap-1">
            {PAGE_SIZE_OPTIONS.map(n => (
              <button key={n} onClick={() => { setPageSize(n); setPage(1); }} className="px-3 py-1.5 rounded-lg font-medium transition-all"
                style={pageSize === n
                  ? { background: "hsl(40 65% 48% / 0.2)", color: "hsl(40 65% 58%)", border: "1px solid hsl(40 65% 48% / 0.4)" }
                  : { background: "hsl(0 0% 14%)", color: "hsl(0 0% 55%)", border: "1px solid hsl(0 0% 20%)" }}>
                {n === 0 ? "الكل" : n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 18%)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid hsl(0 0% 16%)" }}>
              <th className="text-right text-muted-foreground font-medium px-4 py-3 text-xs uppercase tracking-wide">الاسم</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3 text-xs uppercase tracking-wide">الهاتف</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3 text-xs uppercase tracking-wide">الاشتراك</th>
              <th className="text-right text-muted-foreground font-medium px-4 py-3 text-xs uppercase tracking-wide">الانضمام</th>
              <th className="px-4 py-3 text-xs text-muted-foreground font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>جاري التحميل...
                </div>
              </td></tr>
            ) : userList.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">{search ? `لا توجد نتائج لـ "${search}"` : "لا يوجد أعضاء"}</td></tr>
            ) : userList.map((u: any) => (
              <tr key={u.id} style={{ borderBottom: "1px solid hsl(0 0% 14%)" }} className="last:border-0 transition-colors"
                onMouseEnter={e => (e.currentTarget.style.background = "hsl(0 0% 11%)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 55%)" }}>{u.name?.[0]}</div>
                    <span className="font-medium text-foreground">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.phone}</td>
                <td className="px-4 py-3">
                  {u.currentSubscription ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{
                      background: u.currentSubscription.status === "active" ? "hsl(142 60% 50% / 0.15)" : "hsl(0 0% 20%)",
                      color: u.currentSubscription.status === "active" ? "hsl(142 60% 60%)" : "hsl(0 0% 50%)",
                    }}>{u.currentSubscription.subscription?.name ?? "—"}</span>
                  ) : <span className="text-muted-foreground text-xs">بدون اشتراك</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-EG") : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {/* WhatsApp */}
                    <button onClick={() => openWa(u)} title="واتساب" className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ color: "#25D366" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,211,102,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                      <WaIcon />
                    </button>
                    {/* Edit */}
                    <button onClick={() => openEdit(u)} title="تعديل" className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ color: "hsl(40 65% 55%)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "hsl(40 65% 48% / 0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {/* Profile */}
                    <Link href={`/admin/members/${u.id}`}>
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all" style={{ color: "hsl(40 65% 55%)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.background = "hsl(40 65% 48% / 0.12)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.background = "transparent"; }}>
                        الملف
                      </span>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize !== 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">صفحة {page} من {totalPages} — {total} عضو</p>
          <div className="flex gap-1">
            {[["«",()=>setPage(1)],["السابق",()=>setPage(p=>Math.max(1,p-1))]].map(([l,fn]: any) => (
              <button key={l} onClick={fn} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-30" style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}>{l}</button>
            ))}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page-2, totalPages-4));
              const n = start+i;
              return <button key={n} onClick={()=>setPage(n)} className="w-8 h-8 rounded-lg text-xs font-medium"
                style={n===page ? { background:"hsl(40 65% 48% / 0.25)",color:"hsl(40 65% 60%)",border:"1px solid hsl(40 65% 48% / 0.4)"} : { background:"hsl(0 0% 14%)",color:"hsl(0 0% 55%)"}}>{n}</button>;
            })}
            {[["التالي",()=>setPage(p=>Math.min(totalPages,p+1))],["»",()=>setPage(totalPages)]].map(([l,fn]: any) => (
              <button key={l} onClick={fn} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-30" style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}>{l}</button>
            ))}
          </div>
        </div>
      )}
      {pageSize === 0 && <p className="text-xs text-muted-foreground text-center">عرض كل {total} عضو</p>}

      {/* WhatsApp Modal */}
      {waUser && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" style={{ backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: "hsl(0 0% 8%)", border: "1px solid rgba(37,211,102,0.25)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(37,211,102,0.15)", color: "#25D366" }}><WaIcon /></div>
                <div><h2 className="text-base font-bold text-foreground">رسالة واتساب</h2><p className="text-xs text-muted-foreground">{waUser.name} — {waUser.phone}</p></div>
              </div>
              <button onClick={() => setWaUser(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground" style={{ background: "hsl(0 0% 14%)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">نوع الرسالة</label>
                <div className="grid grid-cols-2 gap-2">
                  {WA_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => onTplChange(t.id)} className="px-3 py-2 rounded-lg text-xs font-medium text-right transition-all"
                      style={waTemplateId===t.id ? { background:"rgba(37,211,102,0.15)",color:"#25D366",border:"1px solid rgba(37,211,102,0.35)"} : { background:"hsl(0 0% 13%)",color:"hsl(0 0% 55%)",border:"1px solid hsl(0 0% 20%)"}}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">الرسالة — يمكنك تعديلها</label>
                <textarea value={waMsg} onChange={e=>setWaMsg(e.target.value)} rows={6} dir="rtl"
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none resize-none"
                  style={{ background:"hsl(0 0% 12%)",border:"1px solid hsl(0 0% 22%)",lineHeight:1.7 }} placeholder="اكتب رسالتك هنا..." />
                <p className="text-xs text-muted-foreground mt-1">{waMsg.length} حرف</p>
              </div>
              <div className="flex gap-3">
                <button onClick={sendWa} disabled={!waMsg.trim()} className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2" style={{ background:"#25D366",color:"#fff" }}>
                  <WaIcon /> فتح واتساب وإرسال
                </button>
                <button onClick={()=>setWaUser(null)} className="px-5 py-2.5 rounded-lg text-sm font-semibold" style={{ background:"hsl(0 0% 14%)",color:"hsl(0 0% 70%)" }}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="إضافة عضو جديد" sub="أدخل بيانات العضو" onClose={() => setShowCreate(false)}>
          <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="text-xs font-bold uppercase tracking-widest pb-2" style={{ color:"hsl(40 65% 48%)",borderBottom:"1px solid hsl(40 65% 48% / 0.2)" }}>بيانات العضو</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="الاسم الكامل" error={createForm.formState.errors.name?.message}><input {...createForm.register("name")} placeholder="أحمد محمد" className={inputCls} style={inputSt} /></Field>
              <Field label="رقم الهاتف" error={createForm.formState.errors.phone?.message}><input {...createForm.register("phone")} placeholder="01xxxxxxxxx" className={inputCls} style={inputSt} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="كلمة المرور" error={createForm.formState.errors.password?.message}><input {...createForm.register("password")} type="password" placeholder="••••••" className={inputCls} style={inputSt} /></Field>
              <Field label="الدور"><select {...createForm.register("role")} className={inputCls} style={inputSt}><option value="member">عضو</option><option value="admin">مسؤول</option></select></Field>
            </div>
            <div className="text-xs font-bold uppercase tracking-widest pb-2" style={{ color:"hsl(40 65% 48%)",borderBottom:"1px solid hsl(40 65% 48% / 0.2)" }}>الاشتراك (اختياري)</div>
            <Field label="خطة الاشتراك">
              <select {...createForm.register("subscriptionId")} className={inputCls} style={inputSt}>
                <option value="">— بدون اشتراك —</option>
                {subList.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.duration} يوم — {s.price} ج.م</option>)}
              </select>
            </Field>
            {selSubId && (<>
              {selPlan && <div className="rounded-lg px-3 py-2.5 text-xs flex items-center gap-2" style={{ background:"hsl(142 60% 50% / 0.08)",border:"1px solid hsl(142 60% 50% / 0.2)",color:"hsl(142 60% 60%)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>
                <span>سيتم تعيين <strong>{selPlan.name}</strong> — {selPlan.duration} يوم — <strong>{selPlan.price} ج.م</strong></span>
              </div>}
              <div className="grid grid-cols-2 gap-3">
                <Field label="تاريخ البداية"><input {...createForm.register("startDate")} type="date" className={inputCls} style={inputSt} /></Field>
                <Field label="المبلغ المدفوع"><input {...createForm.register("paymentAmount")} type="number" placeholder={selPlan?.price?.toString()??"0"} className={inputCls} style={inputSt} /></Field>
              </div>
              <Field label="طريقة الدفع"><select {...createForm.register("paymentMethod")} className={inputCls} style={inputSt}>{Object.entries(METHOD_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
            </>)}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={createUser.isPending||assignSub.isPending} className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background:"linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",color:"hsl(0 0% 5%)" }}>
                {createUser.isPending||assignSub.isPending?"جاري الحفظ...":"إضافة العضو"}
              </button>
              <button type="button" onClick={()=>setShowCreate(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background:"hsl(0 0% 14%)",color:"hsl(0 0% 70%)" }}>إلغاء</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <Modal title="تعديل بيانات العضو" sub={editingUser.name} onClose={() => setEditingUser(null)}>
          <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="p-6 space-y-4">
            <Field label="الاسم الكامل" error={editForm.formState.errors.name?.message}><input {...editForm.register("name")} className={inputCls} style={inputSt} /></Field>
            <Field label="رقم الهاتف" error={editForm.formState.errors.phone?.message}><input {...editForm.register("phone")} className={inputCls} style={inputSt} /></Field>
            <Field label="الدور"><select {...editForm.register("role")} className={inputCls} style={inputSt}><option value="member">عضو</option><option value="admin">مسؤول</option></select></Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={updateUser.isPending} className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background:"linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",color:"hsl(0 0% 5%)" }}>
                {updateUser.isPending?"جاري الحفظ...":"حفظ التعديلات"}
              </button>
              <button type="button" onClick={()=>setEditingUser(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background:"hsl(0 0% 14%)",color:"hsl(0 0% 70%)" }}>إلغاء</button>
            </div>
            <div style={{ borderTop:"1px solid hsl(0 0% 16%)",paddingTop:"0.75rem" }}>
              <button type="button" onClick={()=>{ setEditingUser(null); setResettingUser(editingUser); resetForm.reset(); }}
                className="w-full py-2 rounded-lg text-xs font-medium" style={{ color:"hsl(0 0% 50%)",background:"hsl(0 0% 12%)" }}>
                🔑 تغيير كلمة المرور
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" style={{ backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background:"hsl(0 0% 8%)",border:"1px solid hsl(40 65% 48% / 0.2)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom:"1px solid hsl(0 0% 14%)" }}>
              <div><h2 className="text-base font-bold text-foreground">تغيير كلمة المرور</h2><p className="text-xs text-muted-foreground">{resettingUser.name}</p></div>
              <button onClick={()=>setResettingUser(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground" style={{ background:"hsl(0 0% 14%)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={resetForm.handleSubmit(onSubmitReset)} className="p-6 space-y-4">
              <Field label="كلمة المرور الجديدة" error={resetForm.formState.errors.newPassword?.message}>
                <input {...resetForm.register("newPassword")} type="password" placeholder="••••••" className={inputCls} style={inputSt} />
              </Field>
              <div className="flex gap-3">
                <button type="submit" disabled={resetPwd.isPending} className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background:"linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",color:"hsl(0 0% 5%)" }}>
                  {resetPwd.isPending?"جاري الحفظ...":"تغيير كلمة المرور"}
                </button>
                <button type="button" onClick={()=>setResettingUser(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background:"hsl(0 0% 14%)",color:"hsl(0 0% 70%)" }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
