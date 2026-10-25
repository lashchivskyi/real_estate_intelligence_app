import Link from "next/link";
import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { fmtDate, Panel } from "@/components/ops/ui";
import { getDictionary, isLang } from "@/i18n";
import { setLeadStatusAction } from "@/server/actions/ops";
import { requireUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";

export default async function LeadsPage({ params }: PageProps<"/[lang]/admin/leads">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireUser(lang, { cap: "cases.viewAll" });
  const dict = await getDictionary(lang);
  const d = dict.ops;
  const db = await getDb();
  const rows = await db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(200);
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">{d.leads.title}</h1>
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-ink2">{d.leads.empty}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {rows.map((l) => (
              <li key={l.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p>
                    <b>{l.name || "—"}</b> <span className="text-ink2">· {l.kind} · {fmtDate(l.createdAt, lang)}</span>
                  </p>
                  <p className="text-ink2">
                    {l.email} {l.phone && `· ${l.phone}`}
                  </p>
                  {l.note && <p className="mt-1 rounded-lg bg-surface2 px-3 py-1.5">{l.note}</p>}
                  {l.caseId && (
                    <Link href={`/${lang}/admin/cases/${l.caseId}`} className="text-sm font-semibold text-brand">
                      {d.leads.openCase} →
                    </Link>
                  )}
                </div>
                <form action={setLeadStatusAction} className="flex items-center gap-2">
                  <input type="hidden" name="lang" value={lang} />
                  <input type="hidden" name="leadId" value={l.id} />
                  <select name="status" defaultValue={l.status} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
                    {(["new", "contacted", "converted", "lost"] as const).map((s) => (
                      <option key={s} value={s}>
                        {d.leadStatuses[s]}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-full border border-line px-3 py-1.5 text-xs">{d.leads.setStatus}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
