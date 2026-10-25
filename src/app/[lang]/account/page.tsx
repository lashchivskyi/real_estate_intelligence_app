import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, fmtDate, ModuleDots } from "@/components/ops/ui";
import { isStaff } from "@/domain/cases";
import { getCityOrDefault } from "@/domain/location/registry";
import { formatMoney, getDictionary, isLang } from "@/i18n";
import { logoutAction } from "@/server/actions/auth";
import { homeFor, requireUser } from "@/server/auth";
import { listCases } from "@/server/cases";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

/** Client cabinet: my properties (cases), each with the state of its three modules. */
export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang, { next: `/${lang}/account` });
  if (isStaff(user.role)) redirect(homeFor(lang, user.role));
  const dict = await getDictionary(lang);
  const d = dict.account;
  const rows = await listCases(user);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl">{d.title}</h1>
          <p className="mt-2 max-w-2xl text-ink2">{d.lead}</p>
        </div>
        <form action={logoutAction}>
          <input type="hidden" name="lang" value={lang} />
          <button className="text-sm text-ink2 hover:text-ink">{dict.auth.logout}</button>
        </form>
      </div>
      {rows.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center">
          <p className="text-ink2">{d.empty}</p>
          <Link href={`/${lang}/check`} className="mt-5 inline-flex rounded-full bg-brand px-6 py-3 font-medium text-brandink">
            {d.emptyCta}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const city = getCityOrDefault(r.cityId);
            return (
              <li key={r.id}>
                <Link href={`/${lang}/cases/${r.id}`} className="block rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-xs text-ink2">{r.number}</span>
                    <Badge kind={r.status}>{dict.ops.statuses[r.status as keyof typeof dict.ops.statuses]}</Badge>
                  </div>
                  <p className="mt-2 text-lg font-semibold">{r.address || city.names[lang]}</p>
                  <p className="num text-sm text-ink2">
                    {city.names[lang]} · {formatMoney(r.askingPrice, r.currency, lang)}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ModuleDots legal={r.modules.legal} technical={r.modules.technical} />
                      <span className="text-ink2">
                        {[r.modules.digital, r.modules.legal, r.modules.technical].filter((x) => x === "done").length}/3
                      </span>
                    </span>
                    <span className="text-xs text-ink2">
                      {d.created} {fmtDate(r.createdAt, lang).split(" ")[0]}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
