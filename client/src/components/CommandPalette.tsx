/**
 * Lightweight command palette. Activated by Ctrl/Cmd+K (or `?` to show
 * shortcuts help). Built on `cmdk` which we already had in the bundle but
 * weren't using.
 *
 * Why a custom palette instead of just keyboard shortcuts? The previous
 * `Alt+M / Alt+A / ...` shortcuts were undocumented and admin-only. The
 * palette surfaces them as a discoverable list, which is much more useful
 * for new operators and lets members benefit too.
 */
import { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";

interface PaletteCommand {
  id: string;
  label: string;
  /** Hint shown on the right (e.g. shortcut). */
  hint?: string;
  /** Section header this command belongs to. */
  group: string;
  /** Either a route to navigate to, or a callback to invoke. */
  href?: string;
  onRun?: () => void;
  /** Restrict by role; undefined means "show to everyone". */
  roles?: Array<"admin" | "trainer" | "member">;
}

export function CommandPalette() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);

  // Toggle on Ctrl/Cmd+K. Also accept the legacy Alt+ shortcuts so existing
  // muscle memory keeps working: Alt+M → members, Alt+A → attendance, etc.
  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // Direct shortcuts for admins (kept for back-compat).
      if (e.altKey && role === "admin") {
        const map: Record<string, string> = {
          m: "/admin/members",
          a: "/admin/attendance",
          d: "/admin",
          p: "/admin/payments",
          s: "/admin/subscriptions",
          ",": "/admin/settings",
        };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          navigate(target);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, role]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const adminOnly: Array<"admin"> = ["admin"];
    return [
      // Admin commands
      { id: "admin-dashboard", label: t("nav.dashboard"), hint: "Alt+D", group: "Admin", href: "/admin", roles: adminOnly },
      { id: "admin-members", label: t("nav.members"), hint: "Alt+M", group: "Admin", href: "/admin/members", roles: adminOnly },
      { id: "admin-attendance", label: t("nav.attendance"), hint: "Alt+A", group: "Admin", href: "/admin/attendance", roles: adminOnly },
      { id: "admin-subscriptions", label: t("nav.subscriptions"), hint: "Alt+S", group: "Admin", href: "/admin/subscriptions", roles: adminOnly },
      { id: "admin-payments", label: t("nav.payments"), hint: "Alt+P", group: "Admin", href: "/admin/payments", roles: adminOnly },
      { id: "admin-expenses", label: t("nav.expenses"), group: "Admin", href: "/admin/expenses", roles: adminOnly },
      { id: "admin-schedule", label: t("nav.schedule"), group: "Admin", href: "/admin/schedule", roles: adminOnly },
      { id: "admin-analytics", label: t("nav.analytics"), group: "Admin", href: "/admin/analytics", roles: adminOnly },
      { id: "admin-settings", label: t("nav.settings"), hint: "Alt+,", group: "Admin", href: "/admin/settings", roles: adminOnly },
      { id: "admin-renewals", label: t("nav.renewalReminders"), group: "Admin", href: "/admin/renewal-reminders", roles: adminOnly },
      { id: "admin-absent", label: t("nav.absentMembers"), group: "Admin", href: "/admin/absent-members", roles: adminOnly },
      { id: "admin-audit", label: t("nav.auditLog"), group: "Admin", href: "/admin/audit", roles: adminOnly },
      // Member commands
      { id: "member-dashboard", label: t("nav.dashboard"), group: "Member", href: "/member" },
      { id: "member-workouts", label: t("nav.workouts"), group: "Member", href: "/member/workouts" },
      { id: "member-log", label: t("nav.log"), group: "Member", href: "/member/log" },
      { id: "member-stats", label: t("nav.stats"), group: "Member", href: "/member/stats" },
      { id: "member-attendance", label: t("nav.attendance"), group: "Member", href: "/member/attendance" },
      { id: "member-qr", label: t("nav.qr"), group: "Member", href: "/member/qr" },
      { id: "member-settings", label: t("nav.settings"), group: "Member", href: "/member/settings" },
    ];
  }, [t]);

  const visibleCommands = useMemo(() => {
    return commands.filter((c) => {
      if (!c.roles) return true;
      if (!role) return false;
      return c.roles.includes(role as "admin" | "trainer" | "member");
    });
  }, [commands, role]);

  function run(cmd: PaletteCommand): void {
    setOpen(false);
    if (cmd.onRun) cmd.onRun();
    if (cmd.href) navigate(cmd.href);
  }

  if (!open) return null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("shortcuts.title")}
      className="fixed inset-0 z-[10000] flex items-start justify-center p-4 pt-[10vh] bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <Command label={t("shortcuts.title")}>
          <Command.Input
            placeholder={t("common.search")}
            className="w-full px-4 py-3 bg-transparent border-b border-border text-sm outline-none"
            autoFocus
          />
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("common.noData")}
            </Command.Empty>
            {Array.from(new Set(visibleCommands.map((c) => c.group))).map((group) => (
              <Command.Group key={group} heading={group} className="px-2 py-1.5 text-xs text-muted-foreground">
                {visibleCommands
                  .filter((c) => c.group === group)
                  .map((cmd) => (
                    <Command.Item
                      key={cmd.id}
                      value={`${cmd.group} ${cmd.label} ${cmd.hint ?? ""}`}
                      onSelect={() => run(cmd)}
                      className="flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <span>{cmd.label}</span>
                      {cmd.hint && (
                        <kbd className="text-xs text-muted-foreground font-mono">{cmd.hint}</kbd>
                      )}
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </Command.Dialog>
  );
}

export default CommandPalette;
