import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseCompare } from "@/components/compare/case-compare";
import { CompareBuilder } from "@/components/compare/compare-builder";
import { getCityOrDefault } from "@/domain/location/registry";
import { formatMoney, getDictionary, isLang } from "@/i18n";
import { getUser } from "@/server/auth";
import { buildCaseReport, listCases, loadCaseFor } from "@/server/cases";

// Personal data for signed-in users.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/compare">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.compare.title, description: dict.compare.subtitle };
}

/**
 * Compare = a view over the client's saved objects (cases) — the same entities as "My properties".
 * Anonymous visitors get a clearly-labelled demo sandbox and an invitation to save their own objects.
 */
export default async function ComparePage({ params, searchParams }: PageProps<"/[lang]/compare">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  const d = dict.compare;
  const user = await getUser();
  const cases = user ? (await listCases(user)).filter((c) => c.status !== "cancelled").slice(0, 30) : [];

  let content: React.ReactNode;
  if (user && cases.length > 0) {
    const sp = await searchParams;
    const requested = typeof sp.ids === "string" ? sp.ids.split(",") : [];
    const selected = (requested.length ? requested.filter((id) => cases.some((c) => c.id === id)) : cases.map((c) => c.id)).slice(0, 5);
    const bundles = (await Promise.all(selected.map((id) => loadCaseFor(user, id)))).filter((b): b is NonNullable<typeof b> => !!b);
    const reports = await Promise.all(bundles.map(async (b) => ({ caseId: b.case.id, report: await buildCaseReport(b) })));
    const options = cases.map((c) => ({
      id: c.id,
      number: c.number,
      label: `${c.address || getCityOrDefault(c.cityId).names[lang]} · ${formatMoney(c.askingPrice, c.currency, lang)}`,
      done: [c.modules.digital, c.modules.legal, c.modules.technical].filter((x) => x === "done").length,
    }));
    content = <CaseCompare options={options} selected={selected} reports={reports} />;
  } else {
    content = (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 px-5 py-4">
          <p className="max-w-2xl text-sm">
            <span className="font-semibold">{d.sandboxTitle} </span>
            {user ? d.sandboxNoCases : d.sandboxBody}
          </p>
          <Link href={user ? `/${lang}/check` : `/${lang}/login?next=${encodeURIComponent(`/${lang}/compare`)}`} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-brandink">
            {user ? d.addObject : dict.auth.signIn}
          </Link>
        </div>
        <CompareBuilder />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="display text-4xl sm:text-5xl">{d.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink2">{d.subtitle}</p>
      <div className="mt-10">{content}</div>
    </div>
  );
}
