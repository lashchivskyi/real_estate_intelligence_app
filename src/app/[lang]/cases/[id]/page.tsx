import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { DocumentDrop } from "@/components/check/document-drop";
import { CaseDocuments } from "@/components/ops/case-documents";
import { isStaff } from "@/domain/cases";
import { getDictionary, isLang } from "@/i18n";
import { requireUser } from "@/server/auth";
import { buildCaseReport, loadCaseFor } from "@/server/cases";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The dossier of a case: same report as the public preview, plus completed legal/technical modules. */
export default async function CaseReportPage({ params, searchParams }: PageProps<"/[lang]/cases/[id]">) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang, { next: `/${lang}/cases/${id}` });
  const b = await loadCaseFor(user, id);
  if (!b) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const report = await buildCaseReport(b);
  const back = isStaff(user.role) ? `/${lang}/admin/cases/${b.case.id}` : `/${lang}/account`;
  return (
    <>
      <div className="no-print mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <Link href={back} className="text-sm text-ink2 hover:text-ink">
          {isStaff(user.role) ? `← ${b.number}` : dict.account.backToList}
        </Link>
        {typeof sp.requested === "string" && (
          <p className="mt-3 rounded-xl bg-goodbg px-4 py-2 text-sm text-good">{dict.report.order.sentBody}</p>
        )}
      </div>
      <ReportView report={report} />
      <div className="no-print mx-auto grid max-w-6xl gap-5 px-4 pb-16 sm:px-6 lg:grid-cols-2">
        <CaseDocuments lang={lang} dict={dict} docs={b.documents} />
        <DocumentDrop caseId={b.case.id} />
      </div>
    </>
  );
}
