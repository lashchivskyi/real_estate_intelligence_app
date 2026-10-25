import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, fmtDate, Panel, Stat } from "@/components/ops/ui";
import { can } from "@/domain/cases";
import { getCityOrDefault } from "@/domain/location/registry";
import { formatMoney, formatNumber, getDictionary, isLang } from "@/i18n";
import { requireUser } from "@/server/auth";
import { dashboardStats } from "@/server/cases";

/** Owner / manager overview: pipeline, money, bottlenecks, website funnel, team load. */
export default async function AdminHome({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang);
  if (!can(user.role, "dashboard.view")) redirect(`/${lang}/work`);
  const dict = await getDictionary(lang);
  const d = dict.ops;
  const s = await dashboardStats(30);
  const maxFunnel = Math.max(1, ...s.funnel.map((f) => f.n));
  const statuses = ["new", "active", "report_ready", "closed", "cancelled"] as const;
  const totalCases = statuses.reduce((a, k) => a + (s.byStatus[k] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">{d.dashboard.title}</h1>
        <p className="text-sm text-ink2">{d.dashboard.period.replace("{days}", String(s.days))}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={d.dashboard.newCases} value={formatNumber(s.newCases, lang)} />
        <Stat label={d.dashboard.newLeads} value={formatNumber(s.newLeads, lang)} tone={s.newLeads > 0 ? "warn" : undefined} />
        <Stat label={d.dashboard.unassigned} value={formatNumber(s.unassigned, lang)} tone={s.unassigned > 0 ? "bad" : undefined} />
        <Stat label={d.dashboard.revenue} value={formatMoney(s.revenueUah, "UAH", lang)} tone="good" />
        <Stat label={d.dashboard.pipeline} value={formatMoney(s.pipelineUah, "UAH", lang)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={d.dashboard.byStatus}>
          {totalCases === 0 ? (
            <p className="text-sm text-ink2">{d.dashboard.noData}</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full">
                {statuses.map((k) => (
                  <span key={k} className={k === "new" ? "bg-info" : k === "active" ? "bg-brand" : k === "report_ready" ? "bg-good" : k === "closed" ? "bg-ink2/40" : "bg-bad"} style={{ width: `${((s.byStatus[k] ?? 0) / totalCases) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {statuses.map((k) => (
                  <li key={k} className="flex items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2">
                    <Link href={`/${lang}/admin/cases?status=${k}`} className="hover:underline">
                      {d.statuses[k]}
                    </Link>
                    <span className="num font-semibold">{s.byStatus[k] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title={d.dashboard.funnel}>
          <ul className="space-y-2">
            {s.funnel.map((f) => (
              <li key={f.name} className="grid grid-cols-[150px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
                <span className="truncate text-ink2">{d.funnel[f.name as keyof typeof d.funnel]}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface2">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(f.n / maxFunnel) * 100}%` }} />
                </span>
                <span className="num text-right font-semibold">{f.n}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={d.dashboard.byCity}>
          {s.byCity.length === 0 ? (
            <p className="text-sm text-ink2">{d.dashboard.noData}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {s.byCity.map((c) => (
                <li key={c.cityId} className="flex justify-between">
                  <span>{getCityOrDefault(c.cityId).names[lang]}</span>
                  <span className="num font-semibold">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-5 text-sm font-semibold">{d.dashboard.byPackage}</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {s.byPackage.map((p) => (
              <span key={p.packageId} className="rounded-full bg-surface2 px-3 py-1">
                {dict.services.packages[p.packageId as keyof typeof dict.services.packages]?.name ?? p.packageId} · <b className="num">{p.n}</b>
              </span>
            ))}
          </div>
        </Panel>

        <Panel title={d.dashboard.staffLoad}>
          {s.staffLoad.length === 0 ? (
            <p className="text-sm text-ink2">{d.dashboard.noData}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {s.staffLoad.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span>
                    {p.name} <span className="text-ink2">· {d.roles[p.role as keyof typeof d.roles]}</span>
                  </span>
                  <span className="num">
                    {p.open} {d.dashboard.open}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={d.dashboard.recentLeads} right={<Link href={`/${lang}/admin/leads`} className="text-sm font-semibold text-brand">→</Link>}>
        {s.recentLeads.length === 0 ? (
          <p className="text-sm text-ink2">{d.dashboard.noData}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {s.recentLeads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>{l.name || l.email || "—"}</b> <span className="text-ink2">· {l.kind}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge kind={l.status === "new" ? "awaiting_assignment" : "closed"}>{d.leadStatuses[l.status as keyof typeof d.leadStatuses] ?? l.status}</Badge>
                  <span className="num text-xs text-ink2">{fmtDate(l.createdAt, lang)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
