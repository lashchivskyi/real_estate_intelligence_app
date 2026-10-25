import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckForm } from "@/components/check/check-form";
import { getDictionary, isLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/check">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.check.title, description: dict.check.subtitle };
}

export default async function CheckPage({ params }: PageProps<"/[lang]/check">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <h1 className="display text-4xl sm:text-5xl">{dict.check.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink2">{dict.check.subtitle}</p>
      <div className="mt-10">
        <CheckForm />
      </div>
    </div>
  );
}
