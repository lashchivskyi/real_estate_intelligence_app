import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandShowcase } from "@/components/brand/brand-showcase";
import { getDictionary, isLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/brand">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.nav.brand, description: dict.brand.lead };
}

export default async function BrandPage({ params }: PageProps<"/[lang]/brand">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <BrandShowcase />
    </div>
  );
}
