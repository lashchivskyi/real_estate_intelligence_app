import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefWizard } from "@/components/brief/brief-wizard";
import { getDictionary, isLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/brief">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.brief.title, description: dict.brief.subtitle };
}

export default async function BriefPage({ params }: PageProps<"/[lang]/brief">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">{dict.brief.title}</h1>
      <p className="mt-2 text-sm text-ink2">{dict.brief.subtitle}</p>
      <p className="mt-1 text-xs text-ink2">{dict.brief.saved}</p>
      <div className="mt-8">
        <BriefWizard />
      </div>
    </div>
  );
}
