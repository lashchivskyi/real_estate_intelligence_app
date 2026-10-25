import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { getDictionary, isLang } from "@/i18n";
import { assembleLiveReport } from "@/server/live-report";

// Reports depend on the query string and are personal: never index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReportPage({ params, searchParams }: PageProps<"/[lang]/report">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  const result = await assembleLiveReport(await searchParams);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="display text-3xl">{dict.check.title}</h1>
        <p className="mt-4 text-ink2">{dict.check.invalid.replace("{fields}", result.error)}</p>
        <Link href={`/${lang}/check`} className="mt-8 inline-flex rounded-full bg-brand px-6 py-3 font-medium text-brandink">
          {dict.nav.check}
        </Link>
      </div>
    );
  }
  return <ReportView report={result.report} />;
}
