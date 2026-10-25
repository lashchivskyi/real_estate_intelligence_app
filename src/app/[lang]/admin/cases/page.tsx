import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, fmtDate, inputCls, ModuleDots } from "@/components/ops/ui";
import { getCityOrDefault } from "@/domain/location/registry";
import { formatMoney, getDictionary, isLang } from "@/i18n";
import { requireUser } from "@/server/auth";
import { listCases } from "@/server/cases";

export default async function CasesPage({ params, searchParams }: PageProps<"/[lang]/admin/cases">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang, { cap: "cases.viewAll" });
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const dict = await getDictionary(lang);
  const d = dict.ops;
  const rows = await listCases(user, { status: status || undefined, q: q || undefined });
  const statuses = ["", "new", "active", "report_ready", "closed", "cancelled"] as const;
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">{d.cases.title}</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder={d.cases.search} className={`${inputCls} max-w-xs`} />
        <input type="hidden" name="status" value={status} />
        <button className="rounded-full border border-line px-4 text-sm">↵</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Link key={s || "all"} href={`/${lang}/admin/cases${s ? `?status=${s}` : ""}`} className={`rounded-full px-3 py-1.5 text-sm ${status === s ? "bg-ink text-bg" : "border border-line bg-surface"}`}>
            {s ? d.statuses[s] : d.cases.all}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-ink2">
            <tr>
              <th className="p-3">{d.cases.number}</th>
              <th className="p-3">{d.cases.object}</th>
              <th className="p-3">{d.cases.client}</th>
              <th className="p-3">{d.cases.status}</th>
              <th className="p-3">{d.cases.modules}</th>
              <th className="p-3">{d.cases.updated}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-ink2">
                  {d.cases.empty}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-surface2/50">
                <td className="p-3">
                  <Link href={`/${lang}/admin/cases/${r.id}`} className="num font-semibold text-brand">
                    {r.number}
                  </Link>
                </td>
                <td className="p-3">
                  <span className="block font-medium">{r.address || getCityOrDefault(r.cityId).names[lang]}</span>
                  <span className="num text-xs text-ink2">
                    {getCityOrDefault(r.cityId).names[lang]} · {formatMoney(r.askingPrice, r.currency, lang)}
                  </span>
                </td>
                <td className="p-3">
                  <span className="block">{r.clientName || "—"}</span>
                  <span className="text-xs text-ink2">{r.contactEmail}</span>
                </td>
                <td className="p-3">
                  <Badge kind={r.status}>{d.statuses[r.status as keyof typeof d.statuses] ?? r.status}</Badge>
                  <span className={`ml-2 text-xs ${r.paid ? "text-good" : "text-ink2"}`}>{r.paid ? d.cases.paid : d.cases.unpaid}</span>
                </td>
                <td className="p-3">
                  <ModuleDots legal={r.modules.legal} technical={r.modules.technical} />
                </td>
                <td className="num p-3 text-xs text-ink2">{fmtDate(r.updatedAt, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
