import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackagesGrid } from "@/components/services/packages-grid";
import { getDictionary, isLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/services">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.services.title, description: dict.services.subtitle };
}

export default async function ServicesPage({ params }: PageProps<"/[lang]/services">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  const d = dict.services;
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="display text-4xl sm:text-5xl">{d.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink2">{d.subtitle}</p>
      <div className="mt-10">
        <PackagesGrid />
      </div>
      <section className="mt-20 max-w-3xl rounded-2xl border border-dashed border-line p-6">
        <h2 className="text-lg font-semibold">{d.researchTitle}</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink2">
          {d.research.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
