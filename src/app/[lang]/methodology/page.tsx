import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SOURCES } from "@/domain/provenance";
import { getDictionary, isLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/methodology">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.methodology.title, description: dict.methodology.subtitle };
}

export default async function MethodologyPage({ params }: PageProps<"/[lang]/methodology">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  const d = dict.methodology;
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="display text-4xl sm:text-5xl">{d.title}</h1>
      <p className="mt-4 text-lg text-ink2">{d.subtitle}</p>

      <div className="mt-12 space-y-10">
        {d.sections.map((s, i) => (
          <section key={s.t} className="grid gap-2 border-t border-line pt-6 md:grid-cols-[220px_1fr] md:gap-8">
            <h2 className="flex gap-3 text-lg font-semibold">
              <span className="num text-sm text-brand">{String(i + 1).padStart(2, "0")}</span>
              {s.t}
            </h2>
            <p className="text-ink2">{s.d}</p>
          </section>
        ))}
      </div>

      <section className="mt-16 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-xl font-semibold">{d.privacyTitle}</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink2">
          {d.privacy.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold">{d.sourcesTitle}</h2>
        <p className="mt-1 text-ink2">{d.sourcesLead}</p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <tbody>
              {Object.values(SOURCES).map((s) => (
                <tr key={s.id} className="border-b border-line/70 last:border-0">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-ink2">{s.license}</td>
                  <td className="p-3 text-ink2">{s.access}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs">{d.sourceStatus[s.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
