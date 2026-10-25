import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { getDictionary, isLang } from "@/i18n";
import { sampleReport } from "@/lib/report-service";

export async function generateMetadata({ params }: PageProps<"/[lang]/report/sample">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.nav.sample };
}

export default async function SampleReportPage({ params }: PageProps<"/[lang]/report/sample">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <ReportView report={sampleReport()} />;
}
