/**
 * Builds the admin "Member Profile" PDF using jsPDF + jspdf-autotable.
 *
 * Pulled out of the page component so it doesn't clutter the JSX and so
 * it can be re-used (e.g. from a future bulk-export job). All copy here
 * is intentionally English — Arabic glyphs don't render in jsPDF's
 * default Helvetica without an embedded RTL font.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportPdfArgs {
  userId: string;
  memberName: string;
  memberPhone: string;
  activeSub: { subscription?: { name?: string }; startDate?: string; endDate?: string } | null;
  isActive: boolean;
  daysLeft: number | null;
  totalCheckins: number;
  thisMonth: number;
  thisWeek: number;
  templateCount: number;
  history: Array<{
    subscription?: { name?: string };
    startDate?: string;
    endDate?: string;
    paymentAmount?: number | string | null;
    paymentMethod?: string | null;
  }>;
  notesText: string;
}

export function exportMemberPdf(args: ExportPdfArgs): void {
  const {
    userId,
    memberName,
    memberPhone,
    activeSub,
    isActive,
    daysLeft,
    totalCheckins,
    thisMonth,
    thisWeek,
    templateCount,
    history,
    notesText,
  } = args;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFillColor(201, 164, 60);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(10, 10, 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Eagle Gym — Member Profile", 105, 12, { align: "center" });
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 105, 22, { align: "center" });

  autoTable(doc, {
    startY: 28,
    head: [["Field", "Value"]],
    body: [
      ["Name", memberName],
      ["Phone", memberPhone],
      ["Member ID", "#" + userId],
      ["Current Plan", activeSub?.subscription?.name ?? "None"],
      ["Status", isActive ? "Active" : activeSub ? "Expired" : "No Subscription"],
      [
        "Subscription Start",
        activeSub?.startDate ? new Date(activeSub.startDate).toLocaleDateString("en-GB") : "—",
      ],
      [
        "Subscription End",
        activeSub?.endDate ? new Date(activeSub.endDate).toLocaleDateString("en-GB") : "—",
      ],
      ["Days Left", daysLeft !== null ? (daysLeft > 0 ? daysLeft + " days" : "Expired") : "—"],
      ["Total Checkins", totalCheckins],
      ["Checkins This Month", thisMonth],
      ["Checkins This Week", thisWeek],
      ["Workout Templates", templateCount],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30], textColor: [201, 164, 60] },
    alternateRowStyles: { fillColor: [20, 20, 20] },
    bodyStyles: { fillColor: [14, 14, 14], textColor: [200, 200, 200] },
    theme: "plain",
  });

  if (history.length > 0) {
    const prev = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;
    autoTable(doc, {
      startY: prev + 8,
      head: [["Plan", "Start", "End", "Amount", "Method"]],
      body: history.map((h) => [
        h.subscription?.name ?? "—",
        h.startDate ? new Date(h.startDate).toLocaleDateString("en-GB") : "—",
        h.endDate ? new Date(h.endDate).toLocaleDateString("en-GB") : "—",
        h.paymentAmount ? h.paymentAmount + " EGP" : "—",
        h.paymentMethod ?? "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30], textColor: [201, 164, 60] },
      bodyStyles: { fillColor: [14, 14, 14], textColor: [200, 200, 200] },
      theme: "plain",
    });
  }

  if (notesText) {
    const prev2 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 140;
    doc.setTextColor(201, 164, 60);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 14, prev2 + 10);
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(notesText, 180);
    doc.text(lines, 14, prev2 + 17);
  }

  doc.save(`member-${userId}-${memberName.replace(/\s+/g, "-")}.pdf`);
}
