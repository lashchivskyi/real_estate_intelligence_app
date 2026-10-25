import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChecklistExplorer, InspectionExtras } from "@/components/inspection/inspection-client";
import { getDictionary, isLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/inspection">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.inspection.title, description: dict.inspection.subtitle };
}

export default async function InspectionPage({ params }: PageProps<"/[lang]/inspection">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  const d = dict.inspection;
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="display text-4xl sm:text-5xl">{d.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink2">{d.subtitle}</p>

      <aside className="mt-10 rounded-2xl border border-line bg-surface2 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{d.principleTitle}</p>
        <p className="mt-2 max-w-3xl">{d.principle}</p>
      </aside>

      <section className="mt-16">
        <h2 className="display text-3xl">{d.method}</h2>
        <p className="mt-2 max-w-2xl text-ink2">{d.methodLead}</p>
        <div className="mt-6">
          <ChecklistExplorer />
        </div>
      </section>

      <InspectionExtras />
    </div>
  );
}
