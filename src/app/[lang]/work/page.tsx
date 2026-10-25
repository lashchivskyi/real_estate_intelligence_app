import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, fmtDate } from "@/components/ops/ui";
import { can } from "@/domain/cases";
import { getCityOrDefault } from "@/domain/location/registry";
import { getDictionary, isLang } from "@/i18n";
import { requireUser } from "@/server/auth";
import { listCases } from "@/server/cases";

/** Specialist queue: only cases assigned to me (owners see all assigned work). */
export default async function WorkPage({ params }: PageProps<"/[lang]/work">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang);
  const dict = await getDictionary(lang);
  const d = dict.ops.work;
  const all = await listCases(user);
  const isInspector = can(user.role, "inspection.perform");
  const isLawyer = can(user.role, "legal.perform");
  const rows = all.filter((r) => r.status !== "closed" && r.status !== "cancelled" && ((isInspector && r.inspectorId && (user.role === "owner" || r.inspectorId === user.id)) || (isLawyer && r.lawyerId && (user.role === "owner" || r.lawyerId === user.id))));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-3xl">{d.title}</h1>
        <p className="text-sm text-ink2">{d.lead}</p>
      </div>
      {rows.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink2">{d.empty}</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const city = getCityOrDefault(r.cityId);
          const tasks: Array<{ kind: "inspection" | "legal"; state: string }> = [];
          if (isInspector && r.inspectorId && (user.role === "owner" || r.inspectorId === user.id)) tasks.push({ kind: "inspection", state: r.modules.technical });
          if (isLawyer && r.lawyerId && (user.role === "owner" || r.lawyerId === user.id)) tasks.push({ kind: "legal", state: r.modules.legal });
          return (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-5">
              <p className="num text-xs text-ink2">
                {r.number} · {fmtDate(r.updatedAt, lang)}
              </p>
              <p className="mt-1 font-semibold">{r.address || city.names[lang]}</p>
              <p className="text-sm text-ink2">{city.names[lang]}</p>
              <div className="mt-4 space-y-2">
                {tasks.map((t) => (
                  <div key={t.kind} className="flex items-center justify-between gap-2 rounded-xl bg-surface2 px-3 py-2">
                    <span className="text-sm">
                      {t.kind === "inspection" ? d.inspection : d.legal} <Badge kind={t.state}>{dict.report.dossier.states[t.state as keyof typeof dict.report.dossier.states]}</Badge>
                    </span>
                    <Link href={`/${lang}/work/${r.id}/${t.kind}`} className="text-sm font-semibold text-brand">
                      {d.open} →
                    </Link>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
