import { notFound } from "next/navigation";
import { fmtDate, Panel } from "@/components/ops/ui";
import { getDictionary, isLang } from "@/i18n";
import { requireUser } from "@/server/auth";
import { listClients } from "@/server/cases";

export default async function ClientsPage({ params }: PageProps<"/[lang]/admin/clients">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireUser(lang, { cap: "cases.viewAll" });
  const dict = await getDictionary(lang);
  const d = dict.ops.clients;
  const rows = await listClients();
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">{d.title}</h1>
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-ink2">{dict.ops.dashboard.noData}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span>
                  <b>{c.name || c.email}</b> <span className="text-ink2">· {c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
                </span>
                <span className="num text-xs text-ink2">
                  {d.cases}: {c.cases} · {d.registered} {fmtDate(c.createdAt, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
