import { useState, useMemo, useEffect } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useResetUserPassword,
  useDeleteUser,
  getListUsersQueryKey,
  getGetUserQueryKey,
  useListSubscriptions,
  useAssignSubscription,
  getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { PHONE_INPUT_REGEX, toInternationalPhone } from "@/lib/phone";
import { Link as WLink } from "wouter";
import { WaTemplate, getWaTemplates, applyTemplateVars } from "@/api-client/wa-templates";
import { listTrainers, type TrainerOption } from "@/lib/auth-extras";
import {
  bulkExtendMemberSubscriptions,
  bulkFreezeMemberSubscriptions,
  bulkUnfreezeMemberSubscriptions,
  exportMemberSubscriptionsCsv,
} from "@/api-client/member-subscriptions";
import { bulkLogRenewalReminders } from "@/api-client/renewal-reminders";

const PASSWORD_MSG = "كلمة المرور 8 أحرف على الأقل (والحد الأقصى 72)";

const createSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().regex(PHONE_INPUT_REGEX, "صيغة الهاتف غير صحيحة"),
  membershipNumber: z.string().optional(),
  password: z.string().min(8, PASSWORD_MSG).max(72, PASSWORD_MSG),
  role: z.enum(["admin", "trainer", "member"]).default("member").optional(),
  // empty string when no trainer is selected — converted to null on submit
  assignedTrainerId: z.string().optional(),
  subscriptionId: z.coerce.number().optional(),
  startDate: z.string().optional(),
  paymentAmount: z.coerce.number().optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().regex(PHONE_INPUT_REGEX, "صيغة الهاتف غير صحيحة"),
  membershipNumber: z.string().optional(),
  assignedTrainerId: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

const resetSchema = z.object({
  newPassword: z.string().min(8, PASSWORD_MSG).max(72, PASSWORD_MSG),
});
type ResetForm = z.infer<typeof resetSchema>;

// Templates are now fetched from `/api/wa-templates` and managed at
// /admin/wa-templates. This page only consumes them for sending.
const CUSTOM_TEMPLATE_ID = -1;
const GYM_NAME = "Eagle Gym";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 0];
const inputCls =
  "w-full rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all";
const inputSt = { background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" };

type StatusFilter = "all" | "active" | "expired" | "none";

function getSubStatus(u: any): "active" | "expired" | "none" {
  if (!u.currentSubscription?.endDate) return "none";
  return new Date(u.currentSubscription.endDate) >= new Date() ? "active" : "expired";
}

function Field({ label, error, children }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error && <p className="text-destructive text-xs mt-1">⚠ {error}</p>}
    </div>
  );
}

function Modal({ title, sub, onClose, children, accentGreen = false }: any) {
  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-end sm:items-center justify-center z-50 sm:p-4"
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{
          background: "hsl(0 0% 8%)",
          border: `1px solid ${accentGreen ? "rgba(37,211,102,0.25)" : "hsl(40 65% 48% / 0.2)"}`,
        }}
      >
        <div
          className="px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ borderBottom: "1px solid hsl(0 0% 14%)", background: "hsl(0 0% 8%)" }}
        >
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground"
            style={{ background: "hsl(0 0% 14%)" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel = "تأكيد",
  danger = false,
  onConfirm,
  onClose,
}: any) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)" }}
      >
        <div className="p-3 sm:p-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: danger ? "hsl(0 60% 50% / 0.15)" : "hsl(40 65% 48% / 0.15)" }}
          >
            {danger ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6 text-red-400"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
                style={{ color: "hsl(40 65% 55%)" }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <h3 className="text-center font-bold text-foreground mb-2">{title}</h3>
          <p className="text-center text-sm text-muted-foreground mb-6">{description}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
            >
              إلغاء
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={
                danger
                  ? { background: "hsl(0 72% 51%)", color: "#fff" }
                  : {
                      background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                      color: "hsl(0 0% 5%)",
                    }
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
      style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 13%)" }}
    >
      <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "hsl(0 0% 14%)" }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded-full animate-pulse w-36" style={{ background: "hsl(0 0% 14%)" }} />
        <div className="h-2.5 rounded-full animate-pulse w-24" style={{ background: "hsl(0 0% 12%)" }} />
      </div>
      <div className="h-6 w-16 rounded-full animate-pulse" style={{ background: "hsl(0 0% 14%)" }} />
      <div className="h-8 w-8 rounded-lg animate-pulse" style={{ background: "hsl(0 0% 14%)" }} />
    </div>
  );
}

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function AdminMembers() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // Debounce search input -> API query (250ms) to avoid hammering the server
  // on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [trainerFilter, setTrainerFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resettingUser, setResettingUser] = useState<any>(null);
  const [waUser, setWaUser] = useState<any>(null);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);

  // Trainers list — fetched once on mount and reused for create/edit dropdowns
  // and the filter chip. Trainers can be created from the same form by setting
  // role=trainer.
  useEffect(() => {
    let alive = true;
    listTrainers()
      .then((rows) => {
        if (alive) setTrainers(rows);
      })
      .catch(() => {
        /* missing trainers list isn't fatal — UI gracefully hides */
      });
    return () => {
      alive = false;
    };
  }, []);
  const [waTemplateId, setWaTemplateId] = useState<number>(CUSTOM_TEMPLATE_ID);
  const [waMsg, setWaMsg] = useState("");
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  useEffect(() => {
    let alive = true;
    getWaTemplates()
      .then((rows) => {
        if (alive) setWaTemplates(rows.filter((r) => r.enabled));
      })
      .catch(() => {
        /* leaving the list empty falls back to a custom message */
      });
    return () => {
      alive = false;
    };
  }, []);
  const [confirmReset, setConfirmReset] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [showBulkWa, setShowBulkWa] = useState(false);
  // Bulk-action state. We track the *user* IDs (string[]) instead of
  // member-subscription IDs because not every selected user has a current
  // subscription — the UI sometimes wants to act on the user (CSV export,
  // batch WA) regardless of subscription state. Subscription-only actions
  // resolve `currentSubscription.id` from the row at click-time.
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkExtendDays, setBulkExtendDays] = useState<number>(30);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showBulkExtend, setShowBulkExtend] = useState(false);
  const [showBulkSendWa, setShowBulkSendWa] = useState(false);
  const [bulkWaTemplateId, setBulkWaTemplateId] = useState<number>(CUSTOM_TEMPLATE_ID);
  const [bulkWaMsg, setBulkWaMsg] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Cast to `any` because `assignedTrainerId` isn't in the generated
  // ListUsersParams type yet (OpenAPI spec wasn't updated for the trainer
  // filter). The URL builder serializes any extra keys verbatim, so the
  // backend filter still works.
  const qp: Record<string, unknown> = {
    search: search || undefined,
    page,
    limit: pageSize === 0 ? 1000 : pageSize,
  };
  if (trainerFilter === "none") qp.assignedTrainerId = "none";
  else if (trainerFilter) qp.assignedTrainerId = trainerFilter;
  const {
    data: users,
    isLoading,
    isFetching,
    refetch,
  } = useListUsers(qp as never, { query: { queryKey: getListUsersQueryKey(qp as never) } });
  const { data: subsData } = useListSubscriptions({ query: { queryKey: getListSubscriptionsQueryKey() } });
  const { data: allUsersData } = useListUsers(
    { limit: 500 },
    { query: { queryKey: getListUsersQueryKey({ limit: 500 }) } },
  );

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPwd = useResetUserPassword();
  const deleteMember = useDeleteUser();
  const assignSub = useAssignSubscription();

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      role: "member",
      startDate: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
    },
  });
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const selSubId = createForm.watch("subscriptionId");
  const rawList: any[] = Array.isArray(users) ? users : ((users as any)?.data ?? []);
  const total: number = (users as any)?.total ?? rawList.length;
  const subList: any[] = Array.isArray(subsData) ? subsData : [];
  const selPlan = subList.find((s: any) => s.id === Number(selSubId));
  const totalPages = pageSize === 0 ? 1 : Math.ceil(total / pageSize);
  const allList: any[] = Array.isArray(allUsersData) ? allUsersData : ((allUsersData as any)?.data ?? []);

  const userList = useMemo(() => {
    if (statusFilter === "all") return rawList;
    return rawList.filter((u) => getSubStatus(u) === statusFilter);
  }, [rawList, statusFilter]);

  const expiringMembers = useMemo(() => {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return allList.filter((u) => {
      if (!u.currentSubscription?.endDate) return false;
      const end = new Date(u.currentSubscription.endDate);
      return end >= now && end <= soon;
    });
  }, [allList]);

  const statusCounts = useMemo(
    () => ({
      all: rawList.length,
      active: rawList.filter((u) => getSubStatus(u) === "active").length,
      expired: rawList.filter((u) => getSubStatus(u) === "expired").length,
      none: rawList.filter((u) => getSubStatus(u) === "none").length,
    }),
    [rawList],
  );

  function getEndDate(u: any) {
    return u.currentSubscription?.endDate
      ? new Date(u.currentSubscription.endDate).toLocaleDateString("ar-EG")
      : "—";
  }

  function buildVars(u: any) {
    return {
      name: u.name ?? "",
      phone: u.phone ?? "",
      membership_number: u.membershipNumber ?? "",
      end_date: getEndDate(u),
      gym_name: GYM_NAME,
    };
  }
  function openWa(u: any) {
    setWaUser(u);
    const first = waTemplates[0];
    if (first) {
      setWaTemplateId(first.id);
      setWaMsg(applyTemplateVars(first.body, buildVars(u)));
    } else {
      setWaTemplateId(CUSTOM_TEMPLATE_ID);
      setWaMsg("");
    }
  }
  function onTplChange(idStr: string) {
    const id = Number(idStr);
    setWaTemplateId(id);
    if (!waUser) return;
    if (id === CUSTOM_TEMPLATE_ID) {
      setWaMsg("");
      return;
    }
    const t = waTemplates.find((tpl) => tpl.id === id);
    if (t) setWaMsg(applyTemplateVars(t.body, buildVars(waUser)));
  }
  function sendWa() {
    if (!waUser || !waMsg.trim()) return;
    const intl = toInternationalPhone(waUser.phone ?? "");
    if (!intl) return;
    // `noopener,noreferrer` so the new tab cannot reach back into the admin app
    // via `window.opener` (reverse-tabnabbing).
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(waMsg)}`, "_blank", "noopener,noreferrer");
  }

  // ── Bulk selection helpers ──────────────────────────────────────────
  const allRowsSelected = userList.length > 0 && userList.every((u: any) => selectedUserIds.has(u.id));
  function toggleRow(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllOnPage() {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      const ids = userList.map((u: any) => u.id);
      const allHere = ids.every((id: string) => next.has(id));
      if (allHere) ids.forEach((id: string) => next.delete(id));
      else ids.forEach((id: string) => next.add(id));
      return next;
    });
  }
  function clearSelection() {
    setSelectedUserIds(new Set());
  }
  // Resolve which selected users actually have a current subscription —
  // bulk extend / freeze need the member-subscription id, not the user id.
  function selectedSubscriptionIds(filter: "any" | "active" | "frozen" = "any"): number[] {
    const ids: number[] = [];
    for (const u of allList) {
      if (!selectedUserIds.has(u.id)) continue;
      const sub = u.currentSubscription;
      if (!sub?.id) continue;
      if (filter === "active" && sub.status !== "active") continue;
      if (filter === "frozen" && sub.status !== "frozen") continue;
      ids.push(sub.id);
    }
    return ids;
  }

  async function doBulkExtend() {
    const ids = selectedSubscriptionIds("any");
    if (ids.length === 0) {
      toast({ title: "لا يوجد اشتراكات نشطة في التحديد", variant: "destructive" });
      return;
    }
    setBulkBusy(true);
    try {
      const r = await bulkExtendMemberSubscriptions(ids, bulkExtendDays);
      toast({ title: `✅ تم تمديد ${r.updatedCount} اشتراكًا (+${r.days} يوم)` });
      setShowBulkExtend(false);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch {
      toast({ title: "فشل التمديد الجماعي", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function doBulkFreeze() {
    const ids = selectedSubscriptionIds("active");
    if (ids.length === 0) {
      toast({ title: "لا يوجد اشتراكات نشطة قابلة للتجميد", variant: "destructive" });
      return;
    }
    setBulkBusy(true);
    try {
      const r = await bulkFreezeMemberSubscriptions(ids);
      toast({ title: `✅ تم تجميد ${r.frozenCount} اشتراكًا` });
      clearSelection();
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch {
      toast({ title: "فشل التجميد الجماعي", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function doBulkUnfreeze() {
    const ids = selectedSubscriptionIds("frozen");
    if (ids.length === 0) {
      toast({ title: "لا يوجد اشتراكات مجمدة في التحديد", variant: "destructive" });
      return;
    }
    setBulkBusy(true);
    try {
      const r = await bulkUnfreezeMemberSubscriptions(ids);
      toast({ title: `✅ تم إلغاء تجميد ${r.unfrozenCount} اشتراكًا` });
      clearSelection();
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch {
      toast({ title: "فشل إلغاء التجميد الجماعي", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function doBulkExportCsv() {
    if (selectedUserIds.size === 0) return;
    setBulkBusy(true);
    try {
      await exportMemberSubscriptionsCsv(Array.from(selectedUserIds));
      toast({ title: `✅ تم تنزيل CSV (${selectedUserIds.size} عضو)` });
    } catch {
      toast({ title: "فشل تصدير CSV", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  }

  // Bulk WA: open one wa.me tab per selected user, *then* log all sends in
  // one round-trip so the audit trail is correct. Browsers will block
  // window.open when called outside a user gesture, so we batch open()s
  // synchronously inside the click handler before awaiting the log call.
  function openBulkSendWaModal() {
    if (selectedUserIds.size === 0) return;
    // Pick a default template — same logic as the per-row WA modal.
    const first = waTemplates[0];
    if (first) {
      setBulkWaTemplateId(first.id);
      setBulkWaMsg(first.body);
    } else {
      setBulkWaTemplateId(CUSTOM_TEMPLATE_ID);
      setBulkWaMsg("");
    }
    setShowBulkSendWa(true);
  }
  function onBulkTplChange(idStr: string) {
    const id = Number(idStr);
    setBulkWaTemplateId(id);
    if (id === CUSTOM_TEMPLATE_ID) {
      setBulkWaMsg("");
      return;
    }
    const t = waTemplates.find((tpl) => tpl.id === id);
    if (t) setBulkWaMsg(t.body);
  }
  async function doBulkSendWa() {
    if (selectedUserIds.size === 0 || !bulkWaMsg.trim()) return;
    const targets = allList.filter((u: any) => selectedUserIds.has(u.id));
    let opened = 0;
    for (const u of targets) {
      const intl = toInternationalPhone(u.phone ?? "");
      if (!intl) continue;
      // Per-recipient template substitution so each tab gets the right name.
      const text = applyTemplateVars(bulkWaMsg, buildVars(u));
      window.open(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      opened++;
    }
    setShowBulkSendWa(false);
    if (opened === 0) {
      toast({ title: "لم يتم فتح أي محادثة (تحقق من أرقام الهواتف)", variant: "destructive" });
      return;
    }
    try {
      await bulkLogRenewalReminders(
        targets.map((u: any) => u.id),
        "Bulk send from Members page",
      );
    } catch {
      // Don't block UX on logging failures — WA tabs are already open.
    }
    toast({ title: `✅ تم فتح ${opened} محادثة واتساب وتسجيلها` });
    clearSelection();
  }

  function openEdit(u: any) {
    setEditingUser(u);
    editForm.reset({
      name: u.name,
      phone: u.phone ?? "",
      membershipNumber: u.membershipNumber ?? "",
      assignedTrainerId: u.assignedTrainerId ?? "",
    });
  }
  function onSubmitEdit(data: EditForm) {
    if (!editingUser) return;
    // Empty string in the dropdown means "remove trainer" — send null so the
    // backend clears the column. Otherwise the validator complains about
    // "" not being a UUID.
    const payload = {
      ...data,
      assignedTrainerId:
        data.assignedTrainerId && data.assignedTrainerId.trim() !== "" ? data.assignedTrainerId : null,
    };
    updateUser.mutate(
      { userId: editingUser.id, data: payload as never },
      {
        onSuccess: () => {
          toast({ title: "✅ تم تحديث بيانات العضو" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(editingUser.id) });
          setEditingUser(null);
        },
        onError: (err: any) =>
          toast({
            title: "خطأ في التحديث",
            description: err?.response?.data?.message,
            variant: "destructive",
          }),
      },
    );
  }
  function onSubmitCreate(data: CreateForm) {
    const { subscriptionId, startDate, paymentAmount, paymentMethod, assignedTrainerId, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (assignedTrainerId && assignedTrainerId.trim() !== "") {
      payload.assignedTrainerId = assignedTrainerId;
    }
    createUser.mutate(
      { data: payload as never },
      {
        onSuccess: (newUser: any) => {
          const userId = newUser?.id ?? newUser?.user?.id;
          if (subscriptionId && startDate && userId) {
            assignSub.mutate(
              {
                data: {
                  userId,
                  subscriptionId,
                  startDate,
                  ...(paymentAmount ? { paymentAmount } : {}),
                  ...(paymentMethod ? { paymentMethod } : {}),
                },
              },
              {
                onSuccess: () => toast({ title: "✅ تم إضافة العضو وتعيين الاشتراك" }),
                onError: () => toast({ title: "⚠ أُضيف العضو لكن فشل الاشتراك", variant: "destructive" }),
              },
            );
          } else toast({ title: "✅ تم إضافة العضو" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          createForm.reset();
          setShowCreate(false);
        },
        onError: (err: any) =>
          toast({
            title: "خطأ",
            description: err?.response?.data?.message ?? "تحقق من البيانات",
            variant: "destructive",
          }),
      },
    );
  }
  // Surface client-side validation errors as a toast so mobile users see
  // *something* when tapping submit — without this, errors only appear inline
  // next to the offending field, which is easy to miss with the keyboard up.
  function onInvalidCreate(errors: Record<string, { message?: string } | undefined>) {
    const first = Object.values(errors).find((e) => e?.message);
    toast({
      title: "تحقق من البيانات",
      description: first?.message ?? "بعض الحقول غير صحيحة",
      variant: "destructive",
    });
  }
  function onSubmitReset(data: ResetForm) {
    if (!resettingUser) return;
    resetPwd.mutate(
      { userId: resettingUser.id, data: { newPassword: data.newPassword } },
      {
        onSuccess: () => {
          toast({ title: "✅ تم تغيير كلمة المرور" });
          resetForm.reset();
          setResettingUser(null);
          setConfirmReset(null);
        },
        onError: () => toast({ title: "خطأ في تغيير كلمة المرور", variant: "destructive" }),
      },
    );
  }

  function doDeleteMember(u: any) {
    if (!u?.id) return;
    deleteMember.mutate(
      { userId: u.id },
      {
        onSuccess: () => {
          toast({ title: "✅ تم حذف العضو" });
          setSelectedUserIds((prev) => {
            const next = new Set(prev);
            next.delete(u.id);
            return next;
          });
          setConfirmDelete(null);
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
        onError: (err: any) => {
          toast({
            title: err?.data?.message ?? "فشل حذف العضو",
            variant: "destructive",
          });
          setConfirmDelete(null);
        },
      },
    );
  }

  const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
    { key: "all", label: "الكل", color: "hsl(0 0% 50%)" },
    { key: "active", label: "نشط ✅", color: "hsl(142 60% 55%)" },
    { key: "expired", label: "منتهي ⚠️", color: "hsl(30 90% 55%)" },
    { key: "none", label: "بدون اشتراك", color: "hsl(0 0% 40%)" },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">الأعضاء</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إجمالي {total} عضو</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {expiringMembers.length > 0 && (
            <button
              onClick={() => setShowBulkWa(true)}
              className="flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold"
              style={{
                background: "hsl(142 60% 40% / 0.15)",
                color: "hsl(142 60% 60%)",
                border: "1px solid hsl(142 60% 40% / 0.3)",
              }}
            >
              <WaIcon />
              تذكيرات ({expiringMembers.length})
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="تحديث"
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 22%)" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-4 h-4 text-muted-foreground ${isFetching ? "animate-spin" : ""}`}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 5.36A9 9 0 0020.49 15" />
            </svg>
          </button>
          <button
            onClick={() => {
              createForm.reset();
              setShowCreate(true);
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
              color: "hsl(0 0% 5%)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            إضافة عضو
          </button>
        </div>
      </div>

      {/* Search + page size */}
      <div className="flex gap-2 sm:gap-3 items-center">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full rounded-lg pr-10 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
            style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)" }}
            onFocus={(e) => {
              e.target.style.borderColor = "hsl(40 65% 48% / 0.5)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "hsl(0 0% 18%)";
            }}
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none flex-shrink-0"
          style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)" }}
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 0 ? "الكل" : s + " لكل صفحة"}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={
              statusFilter === tab.key
                ? { background: tab.color + "20", color: tab.color, border: `1px solid ${tab.color}50` }
                : { background: "hsl(0 0% 10%)", color: "hsl(0 0% 45%)", border: "1px solid hsl(0 0% 16%)" }
            }
          >
            {tab.label}
            {!isLoading && (
              <span
                className="mr-1.5 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: "hsl(0 0% 0% / 0.2)" }}
              >
                {statusCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Trainer filter */}
      {trainers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">المدرب:</span>
          <select
            value={trainerFilter}
            onChange={(e) => {
              setTrainerFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none"
            style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)" }}
          >
            <option value="">— الكل —</option>
            <option value="none">بدون مدرب</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Select-all-on-page row. Sits above the list so the user can grab a
          page worth of rows in one click; combined with the floating action
          bar below it covers 90% of bulk workflows without a dedicated mode. */}
      {!isLoading && userList.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allRowsSelected}
              onChange={toggleAllOnPage}
              className="w-4 h-4 rounded"
              style={{ accentColor: "hsl(40 65% 52%)" }}
            />
            تحديد الصفحة ({userList.length})
          </label>
          {selectedUserIds.size > 0 && (
            <button
              onClick={clearSelection}
              className="text-xs px-2 py-1 rounded-md"
              style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
            >
              مسح التحديد ({selectedUserIds.size})
            </button>
          )}
        </div>
      )}

      {/* Member list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : userList.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl"
            style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 14%)" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "hsl(0 0% 12%)" }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-8 h-8 text-muted-foreground"
              >
                <circle cx="9" cy="7" r="4" />
                <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
              </svg>
            </div>
            <p className="text-foreground font-semibold">لا يوجد أعضاء</p>
            <p className="text-muted-foreground text-sm mt-1">
              {statusFilter !== "all"
                ? "لا يوجد أعضاء في هذه الفئة"
                : search
                  ? "لا توجد نتائج لبحثك"
                  : "أضف أول عضو الآن"}
            </p>
          </div>
        ) : (
          userList.map((u: any) => {
            const status = getSubStatus(u);
            const isFrozen = u.currentSubscription?.status === "frozen";
            const selected = selectedUserIds.has(u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all"
                style={{
                  background: selected ? "hsl(40 65% 48% / 0.08)" : "hsl(0 0% 9%)",
                  border: selected ? "1px solid hsl(40 65% 48% / 0.4)" : "1px solid hsl(0 0% 14%)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = selected
                    ? "hsl(40 65% 48% / 0.6)"
                    : "hsl(40 65% 48% / 0.2)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = selected ? "hsl(40 65% 48% / 0.4)" : "hsl(0 0% 14%)")
                }
              >
                {/* Bulk-select checkbox */}
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleRow(u.id)}
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ accentColor: "hsl(40 65% 52%)" }}
                  aria-label={`تحديد ${u.name}`}
                />
                {/* Avatar */}
                <Link href={`/admin/members/${u.id}`}>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))",
                      color: "hsl(40 65% 68%)",
                      border: "1.5px solid hsl(40 65% 40% / 0.3)",
                    }}
                  >
                    {u.name?.[0] ?? "?"}
                  </div>
                </Link>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/members/${u.id}`}>
                    <p className="text-sm font-semibold text-foreground truncate cursor-pointer hover:underline">
                      {u.name}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-xs text-muted-foreground">{u.phone}</p>
                    {u.currentSubscription?.name && (
                      <span className="text-xs text-muted-foreground">· {u.currentSubscription.name}</span>
                    )}
                    {u.currentSubscription?.endDate && (
                      <span className="text-xs text-muted-foreground">
                        · ينتهي {new Date(u.currentSubscription.endDate).toLocaleDateString("ar-EG")}
                      </span>
                    )}
                    {isFrozen && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: "hsl(210 80% 55% / 0.15)", color: "hsl(210 80% 65%)" }}
                      >
                        ❄️ مجمد
                      </span>
                    )}
                  </div>
                </div>
                {/* Status badge */}
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
                  style={
                    isFrozen
                      ? { background: "hsl(210 80% 55% / 0.15)", color: "hsl(210 80% 65%)" }
                      : status === "active"
                        ? { background: "hsl(142 60% 50% / 0.15)", color: "hsl(142 60% 60%)" }
                        : status === "expired"
                          ? { background: "hsl(30 90% 55% / 0.15)", color: "hsl(30 90% 60%)" }
                          : { background: "hsl(0 0% 16%)", color: "hsl(0 0% 45%)" }
                  }
                >
                  {isFrozen ? "مجمد" : status === "active" ? "نشط" : status === "expired" ? "منتهي" : "بدون"}
                </span>
                {/* Actions */}
                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                  <button
                    onClick={() => openWa(u)}
                    title="واتساب"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{ color: "#25D366" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(37,211,102,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <WaIcon />
                  </button>
                  <button
                    onClick={() => openEdit(u)}
                    title="تعديل"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-muted-foreground"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "hsl(40 65% 48% / 0.12)";
                      e.currentTarget.style.color = "hsl(40 65% 58%)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "";
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmReset(u)}
                    title="تغيير كلمة المرور"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-muted-foreground"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "hsl(0 72% 51% / 0.1)";
                      e.currentTarget.style.color = "hsl(0 72% 60%)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "";
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(u)}
                    title="حذف العضو"
                    disabled={deleteMember.isPending}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-muted-foreground disabled:opacity-40"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "hsl(0 72% 51% / 0.12)";
                      e.currentTarget.style.color = "hsl(0 72% 60%)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "";
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                  <Link href={`/admin/members/${u.id}`}>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-muted-foreground cursor-pointer"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "hsl(0 0% 16%)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </div>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 transition-colors"
            style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="w-4 h-4"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3;
            if (p < 1 || p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="w-8 h-8 rounded-lg text-sm font-medium transition-all"
                style={
                  p === page
                    ? {
                        background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                        color: "hsl(0 0% 5%)",
                      }
                    : {
                        background: "hsl(0 0% 12%)",
                        border: "1px solid hsl(0 0% 20%)",
                        color: "hsl(0 0% 55%)",
                      }
                }
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 transition-colors"
            style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="w-4 h-4"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      )}

      {/* Confirm reset password modal */}
      {confirmReset && (
        <ConfirmModal
          title="تغيير كلمة المرور"
          description={`هل تريد تغيير كلمة مرور "${confirmReset.name}"؟`}
          confirmLabel="نعم، تغيير"
          danger={true}
          onClose={() => setConfirmReset(null)}
          onConfirm={() => {
            setResettingUser(confirmReset);
            setConfirmReset(null);
            resetForm.reset();
          }}
        />
      )}

      {/* Confirm delete member modal */}
      {confirmDelete && (
        <ConfirmModal
          title="حذف العضو"
          description={`هل تريد حذف العضو "${confirmDelete.name}" نهائياً؟ سيتم حذف كل بياناته (الاشتراكات، الحضور، السجلات…). لا يمكن التراجع.`}
          confirmLabel={deleteMember.isPending ? "جاري الحذف..." : "نعم، احذف"}
          danger={true}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => doDeleteMember(confirmDelete)}
        />
      )}

      {/* Reset password modal */}
      {resettingUser && (
        <Modal title="تغيير كلمة المرور" sub={resettingUser.name} onClose={() => setResettingUser(null)}>
          <form
            onSubmit={resetForm.handleSubmit(onSubmitReset)}
            className="p-3 sm:p-6 space-y-4 sm:space-y-4"
          >
            <Field label="كلمة المرور الجديدة" error={resetForm.formState.errors.newPassword?.message}>
              <input
                {...resetForm.register("newPassword")}
                type="password"
                className={inputCls}
                style={inputSt}
                placeholder="8 أحرف على الأقل"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={resetPwd.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: "hsl(0 72% 51%)", color: "#fff" }}
              >
                {resetPwd.isPending ? "جاري التغيير..." : "🔒 تغيير كلمة المرور"}
              </button>
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="px-4 rounded-xl text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* WA modal */}
      {waUser && (
        <Modal title="رسالة واتساب" sub={waUser.name} onClose={() => setWaUser(null)} accentGreen>
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-4">
            <Field label="نوع الرسالة">
              <div className="flex items-center gap-2">
                <select
                  value={waTemplateId}
                  onChange={(e) => onTplChange(e.target.value)}
                  className={inputCls}
                  style={inputSt}
                >
                  {waTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value={CUSTOM_TEMPLATE_ID}>رسالة مخصصة ✏️</option>
                </select>
                <WLink href="/admin/wa-templates">
                  <button
                    type="button"
                    className="px-2.5 py-2.5 rounded-lg text-xs whitespace-nowrap"
                    style={{
                      background: "hsl(0 0% 14%)",
                      color: "hsl(40 65% 60%)",
                      border: "1px solid hsl(0 0% 22%)",
                    }}
                    title="إدارة القوالب"
                  >
                    إدارة القوالب
                  </button>
                </WLink>
              </div>
            </Field>
            <Field label="نص الرسالة">
              <textarea
                value={waMsg}
                onChange={(e) => setWaMsg(e.target.value)}
                rows={5}
                className={inputCls + " resize-none"}
                style={inputSt}
                placeholder="اكتب رسالتك..."
              />
            </Field>
            <div className="flex gap-3">
              <button
                onClick={sendWa}
                disabled={!waMsg.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "#25D366", color: "#fff" }}
              >
                <WaIcon /> إرسال واتساب
              </button>
              <button
                onClick={() => setWaUser(null)}
                className="px-4 rounded-xl text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk WA reminders */}
      {showBulkWa && (
        <Modal
          title={`تذكيرات الاشتراك (${expiringMembers.length})`}
          sub="اشتراكات تنتهي خلال 7 أيام"
          onClose={() => setShowBulkWa(false)}
          accentGreen
        >
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {expiringMembers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 16%)" }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.phone} · ينتهي {new Date(u.currentSubscription.endDate).toLocaleDateString("ar-EG")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowBulkWa(false);
                    openWa(u);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: "rgba(37,211,102,0.1)",
                    color: "#25D366",
                    border: "1px solid rgba(37,211,102,0.2)",
                  }}
                >
                  <WaIcon /> إرسال
                </button>
              </div>
            ))}
            {expiringMembers.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">
                لا توجد اشتراكات قريبة من الانتهاء
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editingUser && (
        <Modal title="تعديل بيانات العضو" sub={editingUser.name} onClose={() => setEditingUser(null)}>
          <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="p-3 sm:p-6 space-y-4 sm:space-y-4">
            <Field label="الاسم" error={editForm.formState.errors.name?.message}>
              <input {...editForm.register("name")} className={inputCls} style={inputSt} />
            </Field>
            <Field label="رقم الهاتف" error={editForm.formState.errors.phone?.message}>
              <input {...editForm.register("phone")} className={inputCls} style={inputSt} />
            </Field>
            <Field
              label="رقم العضوية / ID (اختياري)"
              error={editForm.formState.errors.membershipNumber?.message}
            >
              <input
                {...editForm.register("membershipNumber")}
                className={inputCls}
                style={inputSt}
                placeholder="كود البحث أو الباركود"
              />
            </Field>
            {trainers.length > 0 && (
              <Field label="المدرب المسؤول">
                <select {...editForm.register("assignedTrainerId")} className={inputCls} style={inputSt}>
                  <option value="">— بدون مدرب —</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.phone ? ` (${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={updateUser.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                  color: "hsl(0 0% 5%)",
                }}
              >
                {updateUser.isPending ? "جاري الحفظ..." : "✅ حفظ التغييرات"}
              </button>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 rounded-xl text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="إضافة عضو جديد" onClose={() => setShowCreate(false)}>
          <form
            onSubmit={createForm.handleSubmit(onSubmitCreate, onInvalidCreate)}
            className="p-3 sm:p-6 space-y-4 sm:space-y-4"
          >
            <Field label="الاسم الكامل" error={createForm.formState.errors.name?.message}>
              <input
                {...createForm.register("name")}
                className={inputCls}
                style={inputSt}
                placeholder="مثال: أحمد محمد"
              />
            </Field>
            <Field label="رقم الهاتف" error={createForm.formState.errors.phone?.message}>
              <input
                {...createForm.register("phone")}
                type="tel"
                className={inputCls}
                style={inputSt}
                placeholder="01xxxxxxxxx"
              />
            </Field>
            <Field
              label="رقم العضوية / ID (اختياري)"
              error={createForm.formState.errors.membershipNumber?.message}
            >
              <input
                {...createForm.register("membershipNumber")}
                className={inputCls}
                style={inputSt}
                placeholder="مثال: EAGLE-001"
              />
            </Field>
            <Field label="كلمة المرور" error={createForm.formState.errors.password?.message}>
              <input
                {...createForm.register("password")}
                type="password"
                className={inputCls}
                style={inputSt}
                placeholder="8 أحرف على الأقل"
              />
            </Field>
            <Field label="الدور" error={createForm.formState.errors.role?.message}>
              <select
                {...createForm.register("role")}
                className={inputCls}
                style={inputSt}
                defaultValue="member"
              >
                <option value="member">عضو</option>
                <option value="trainer">مدرب</option>
                <option value="admin">إدارة</option>
              </select>
            </Field>
            {trainers.length > 0 && (
              <Field label="المدرب المسؤول (اختياري)">
                <select {...createForm.register("assignedTrainerId")} className={inputCls} style={inputSt}>
                  <option value="">— بدون مدرب —</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.phone ? ` (${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="border-t pt-4" style={{ borderColor: "hsl(0 0% 16%)" }}>
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                اشتراك (اختياري)
              </p>
              <Field label="خطة الاشتراك">
                <select {...createForm.register("subscriptionId")} className={inputCls} style={inputSt}>
                  <option value="">-- بدون اشتراك --</option>
                  {subList.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.price} جنيه / {s.durationDays} يوم
                    </option>
                  ))}
                </select>
              </Field>
              {selSubId && (
                <>
                  <Field label="تاريخ البداية">
                    <input
                      {...createForm.register("startDate")}
                      type="date"
                      className={inputCls}
                      style={inputSt}
                    />
                  </Field>
                  <Field label="طريقة الدفع">
                    <select {...createForm.register("paymentMethod")} className={inputCls} style={inputSt}>
                      <option value="cash">نقدي</option>
                      <option value="card">بطاقة</option>
                      <option value="transfer">تحويل</option>
                    </select>
                  </Field>
                  <Field label="المبلغ المدفوع">
                    <input
                      {...createForm.register("paymentAmount")}
                      type="number"
                      className={inputCls}
                      style={inputSt}
                      placeholder={`${selPlan?.price ?? ""}`}
                    />
                  </Field>
                </>
              )}
            </div>
            {/* Sticky submit bar — keeps the action visible on small phones
                when the on-screen keyboard pushes the bottom of the form
                out of view. Adds a top border so it reads as a footer. */}
            <div
              className="sticky bottom-0 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6 px-3 sm:px-6 py-3 flex gap-3"
              style={{ background: "hsl(0 0% 8%)", borderTop: "1px solid hsl(0 0% 14%)" }}
            >
              <button
                type="submit"
                disabled={createUser.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                  color: "hsl(0 0% 5%)",
                }}
              >
                {createUser.isPending ? "جاري الإضافة..." : "✅ إضافة العضو"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 rounded-xl text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Floating bulk-action bar. Appears as soon as one row is selected;
          actions either fire directly (export, freeze, unfreeze) or open a
          modal for additional input (extend days, WA template). */}
      {selectedUserIds.size > 0 && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl"
          style={{
            background: "hsl(0 0% 8%)",
            border: "1px solid hsl(40 65% 48% / 0.4)",
            backdropFilter: "blur(8px)",
            maxWidth: "calc(100vw - 16px)",
          }}
        >
          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "hsl(40 65% 60%)" }}>
            {selectedUserIds.size} محدد
          </span>
          <span className="w-px h-5" style={{ background: "hsl(0 0% 18%)" }} />
          <button
            onClick={() => setShowBulkExtend(true)}
            disabled={bulkBusy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{
              background: "hsl(40 65% 48% / 0.15)",
              color: "hsl(40 65% 65%)",
              border: "1px solid hsl(40 65% 48% / 0.3)",
            }}
          >
            تمديد +أيام
          </button>
          <button
            onClick={doBulkFreeze}
            disabled={bulkBusy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{
              background: "hsl(210 80% 55% / 0.15)",
              color: "hsl(210 80% 65%)",
              border: "1px solid hsl(210 80% 55% / 0.3)",
            }}
          >
            ❄️ تجميد
          </button>
          <button
            onClick={doBulkUnfreeze}
            disabled={bulkBusy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 75%)", border: "1px solid hsl(0 0% 22%)" }}
          >
            ☀️ إلغاء التجميد
          </button>
          <button
            onClick={openBulkSendWaModal}
            disabled={bulkBusy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            style={{
              background: "rgba(37,211,102,0.15)",
              color: "#25D366",
              border: "1px solid rgba(37,211,102,0.3)",
            }}
          >
            <WaIcon /> واتساب
          </button>
          <button
            onClick={doBulkExportCsv}
            disabled={bulkBusy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 75%)", border: "1px solid hsl(0 0% 22%)" }}
          >
            📥 تصدير CSV
          </button>
          <button
            onClick={clearSelection}
            disabled={bulkBusy}
            className="text-xs px-2 py-1.5 rounded-lg"
            style={{ color: "hsl(0 0% 55%)" }}
            title="مسح التحديد"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bulk-extend modal — admin chooses how many days to add. */}
      {showBulkExtend && (
        <Modal
          title="تمديد جماعي"
          sub={`${selectedUserIds.size} عضو محدد`}
          onClose={() => setShowBulkExtend(false)}
        >
          <div className="p-3 sm:p-6 space-y-4">
            <Field label="عدد الأيام">
              <input
                type="number"
                min={1}
                max={365}
                value={bulkExtendDays}
                onChange={(e) => setBulkExtendDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
                className={inputCls}
                style={inputSt}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              سيتم تمديد تاريخ نهاية الاشتراك للأعضاء المحددين الذين لديهم اشتراكات حالية بـ{" "}
              <span className="font-bold" style={{ color: "hsl(40 65% 60%)" }}>
                {bulkExtendDays}
              </span>{" "}
              يوم.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={doBulkExtend}
                disabled={bulkBusy}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))",
                  color: "hsl(0 0% 5%)",
                }}
              >
                {bulkBusy ? "جاري التمديد..." : "✅ تأكيد التمديد"}
              </button>
              <button
                type="button"
                onClick={() => setShowBulkExtend(false)}
                className="px-4 rounded-xl text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk-send-WA modal — admin chooses template, opens N tabs. */}
      {showBulkSendWa && (
        <Modal
          title="إرسال واتساب جماعي"
          sub={`${selectedUserIds.size} عضو`}
          onClose={() => setShowBulkSendWa(false)}
          accentGreen
        >
          <div className="p-3 sm:p-6 space-y-4">
            <Field label="نوع الرسالة">
              <select
                value={bulkWaTemplateId}
                onChange={(e) => onBulkTplChange(e.target.value)}
                className={inputCls}
                style={inputSt}
              >
                {waTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                <option value={CUSTOM_TEMPLATE_ID}>رسالة مخصصة ✏️</option>
              </select>
            </Field>
            <Field label="نص الرسالة">
              <textarea
                value={bulkWaMsg}
                onChange={(e) => setBulkWaMsg(e.target.value)}
                rows={5}
                className={inputCls + " resize-none"}
                style={inputSt}
                placeholder="اكتب رسالتك..."
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              سيتم فتح علامة تبويب لكل عضو. قد يطلب المتصفح السماح بفتح النوافذ. المتغيرات مثل {"{name}"} يتم
              استبدالها لكل عضو.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={doBulkSendWa}
                disabled={!bulkWaMsg.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "#25D366", color: "#fff" }}
              >
                <WaIcon /> إرسال للكل
              </button>
              <button
                type="button"
                onClick={() => setShowBulkSendWa(false)}
                className="px-4 rounded-xl text-sm"
                style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
