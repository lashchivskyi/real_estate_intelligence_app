import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, fmtDate, Panel, SelectField, SubmitButton, TextArea } from "@/components/ops/ui";
import { CaseDocuments } from "@/components/ops/case-documents";
import { getCityOrDefault } from "@/domain/location/registry";
import { formatMoney, getDictionary, isLang } from "@/i18n";
import { updateCaseAction } from "@/server/actions/ops";
import { requireUser } from "@/server/auth";
import { listStaff, loadCaseFor } from "@/server/cases";

/** Case management: who works on it, what is ordered, status, notes, documents, history. */
export default async function AdminCasePage({ params, searchParams }: PageProps<"/[lang]/admin/cases/[id]">) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang, { cap: "cases.viewAll" });
  const b = await loadCaseFor(user, id);
  if (!b) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const d = dict.ops;
  const cd = d.caseDetail;
  const staff = await listStaff();
  const opt = (role: string) => [{ value: "", label: cd.none }, ...staff.filter((s) => s.role === role && !s.disabled).map((s) => ({ value: s.id, label: s.name || s.email }))];
  const p = b.property;
  const city = getCityOrDefault(p.cityId);
  const district = city.districts.find((x) => x.id === p.districtId);
  const brief = (b.case.brief ?? {}) as Record<string, unknown>;
  // Human-readable audit details: ids → names, keys → field labels, statuses → labels.
  const fieldLabel: Record<string, string> = {
    managerId: cd.manager,
    inspectorId: cd.inspector,
    lawyerId: cd.lawyer,
    legalOrdered: cd.legalOrdered,
    inspectionOrdered: cd.inspectionOrdered,
    paid: cd.paid,
    internalNote: cd.internalNote,
    status: cd.status,
  };
  const nameOf = (v: unknown) => (typeof v === "string" ? (staff.find((s) => s.id === v)?.name ?? (d.statuses as Record<string, string>)[v] ?? v) : v === true ? "✓" : v === false ? "✗" : v === null ? "—" : String(v));
  const describeMeta = (m: Record<string, unknown>) =>
    "from" in m && "to" in m
      ? `${nameOf(m.from)} → ${nameOf(m.to)}`
      : Object.entries(m)
          .filter(([k]) => k !== "issueId" && k !== "documentId")
          .map(([k, v]) => `${fieldLabel[k] ?? k}: ${nameOf(v)}`)
          .join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="num text-sm text-ink2">{b.number}</p>
          <h1 className="display text-3xl">{p.address || city.names[lang]}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink2">
            <Badge kind={b.case.status}>{d.statuses[b.case.status as keyof typeof d.statuses]}</Badge>
            <span>
              {cd.package}: {dict.services.packages[b.case.packageId as keyof typeof dict.services.packages]?.name ?? b.case.packageId}
            </span>
            <span>
              · {cd.created} {fmtDate(b.case.createdAt, lang)} · {cd.source}: {b.case.source}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${lang}/cases/${b.case.id}`} className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brandink">
            {cd.openReport}
          </Link>
          {b.case.inspectorId && (
            <Link href={`/${lang}/work/${b.case.id}/inspection`} className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm">
              {cd.openInspection}
            </Link>
          )}
          {b.case.lawyerId && (
            <Link href={`/${lang}/work/${b.case.id}/legal`} className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm">
              {cd.openLegal}
            </Link>
          )}
        </div>
      </div>
      {sp.saved && <p className="rounded-xl bg-goodbg px-4 py-2 text-sm text-good">{cd.saved}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title={cd.assignment}>
          <form action={updateCaseAction} className="space-y-4">
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="caseId" value={b.case.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label={cd.manager} name="managerId" defaultValue={b.case.managerId} options={[{ value: "", label: cd.none }, ...staff.filter((s) => (s.role === "manager" || s.role === "owner") && !s.disabled).map((s) => ({ value: s.id, label: s.name || s.email }))]} />
              <SelectField label={cd.inspector} name="inspectorId" defaultValue={b.case.inspectorId} options={opt("inspector")} />
              <SelectField label={cd.lawyer} name="lawyerId" defaultValue={b.case.lawyerId} options={opt("lawyer")} />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="legalOrdered" defaultChecked={b.case.legalOrdered} /> {cd.legalOrdered}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="inspectionOrdered" defaultChecked={b.case.inspectionOrdered} /> {cd.inspectionOrdered}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="paid" defaultChecked={b.case.paid} /> {cd.paid}
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["digital", "legal", "technical"] as const).map((k) => (
                <div key={k} className="rounded-xl bg-surface2 px-3 py-2 text-sm">
                  <span className="block text-ink2">{dict.report.dossier.modules[k]}</span>
                  <Badge kind={b.modules[k]}>{dict.report.dossier.states[b.modules[k]]}</Badge>
                </div>
              ))}
            </div>
            <SelectField
              label={cd.status}
              name="status"
              defaultValue={b.case.status}
              options={(["new", "active", "report_ready", "closed", "cancelled"] as const).map((s) => ({ value: s, label: d.statuses[s] }))}
            />
            <p className="-mt-2 text-xs text-ink2">{cd.statusAuto}</p>
            <TextArea label={cd.internalNote} name="internalNote" defaultValue={b.case.internalNote} />
            <SubmitButton>{cd.save}</SubmitButton>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title={cd.client}>
            <dl className="space-y-1 text-sm">
              <div>
                <b>{b.client?.name || b.case.contactName || "—"}</b>
              </div>
              <div className="text-ink2">{b.client?.email || b.case.contactEmail || "—"}</div>
              <div className="num text-ink2">{b.client?.phone || b.case.contactPhone || ""}</div>
            </dl>
            {b.case.clientNote && <p className="mt-3 rounded-lg bg-surface2 p-3 text-sm">{b.case.clientNote}</p>}
          </Panel>
          <Panel title={cd.property}>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-ink2">{dict.check.fields.city}</dt>
              <dd>{city.names[lang]}{district ? ` · ${district.names[lang]}` : ""}</dd>
              <dt className="text-ink2">{dict.check.fields.askingPriceShort}</dt>
              <dd className="num">{formatMoney(p.askingPrice, p.currency, lang)}</dd>
              <dt className="text-ink2">{dict.check.fields.area}</dt>
              <dd className="num">{p.areaSqm}</dd>
              <dt className="text-ink2">{dict.check.fields.rooms}</dt>
              <dd className="num">{p.rooms ?? "—"}</dd>
              <dt className="text-ink2">{dict.check.fields.floor}</dt>
              <dd className="num">{p.floor ?? "—"}{p.floorsTotal ? `/${p.floorsTotal}` : ""}</dd>
              <dt className="text-ink2">{dict.check.fields.yearBuilt}</dt>
              <dd className="num">{p.yearBuilt ?? "—"}</dd>
            </dl>
          </Panel>
          <Panel title={cd.brief}>
            {Object.keys(brief).length === 0 ? (
              <p className="text-sm text-ink2">{cd.noBrief}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {Object.entries(brief).map(([k, v]) => (
                  <li key={k}>
                    <span className="text-ink2">{k}:</span> {Array.isArray(v) ? v.join(", ") : String(v)}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CaseDocuments lang={lang} dict={dict} docs={b.documents} />
        <Panel title={cd.timeline}>
          <ol className="space-y-2 text-sm">
            {b.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-line/60 pb-2 last:border-0">
                <span>
                  <b>{d.audit[a.action as keyof typeof d.audit] ?? a.action}</b>{" "}
                  <span className="text-ink2">· {a.actorName ? `${a.actorName} (${d.roles[a.actorRole as keyof typeof d.roles] ?? a.actorRole})` : d.system}</span>
                  {Object.keys(a.meta ?? {}).length > 0 && <span className="block text-xs text-ink2">{describeMeta(a.meta as Record<string, unknown>)}</span>}
                </span>
                <span className="num text-xs text-ink2">{fmtDate(a.createdAt, lang)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
