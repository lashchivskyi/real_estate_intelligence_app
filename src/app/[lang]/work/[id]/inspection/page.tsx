import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CaseReference } from "@/components/ops/case-reference";
import { Panel, SelectField, SubmitButton, TextArea, inputCls } from "@/components/ops/ui";
import { can } from "@/domain/cases";
import { RESIDENTIAL_APARTMENT_CHECKLIST } from "@/domain/inspection";
import { formatMoney, getDictionary, isLang } from "@/i18n";
import { addIssueAction, deleteIssueAction, reopenInspectionAction, saveInspectionAction } from "@/server/actions/ops";
import { requireUser } from "@/server/auth";
import { loadCaseFor } from "@/server/cases";

const localInput = (d: Date | null) => {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Inspector's working form: reference on the left, structured checklist + findings on the right. */
export default async function InspectionFormPage({ params, searchParams }: PageProps<"/[lang]/work/[id]/inspection">) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang, { cap: "inspection.perform" });
  const b = await loadCaseFor(user, id);
  if (!b || (b.case.inspectorId !== user.id && user.role !== "owner")) redirect(`/${lang}/work`);
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const d = dict.ops.inspection;
  const submitted = b.inspection?.status === "submitted";
  const cl = b.inspection?.checklist ?? {};
  const e = dict.enums;

  return (
    <div className="space-y-5">
      <Link href={`/${lang}/work`} className="text-sm text-ink2 hover:text-ink">
        {dict.ops.work.back}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="num text-sm text-ink2">{b.number}</p>
          <h1 className="display text-3xl">{d.title}</h1>
        </div>
        {submitted && (
          <form action={reopenInspectionAction}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="caseId" value={b.case.id} />
            <SubmitButton variant="secondary">{d.reopen}</SubmitButton>
          </form>
        )}
      </div>
      {sp.saved && <p className="rounded-xl bg-goodbg px-4 py-2 text-sm text-good">{sp.saved === "submitted" ? d.submitted : dict.ops.caseDetail.saved}</p>}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <CaseReference lang={lang} dict={dict} b={b} />

        <div className="space-y-6">
          <form action={saveInspectionAction} className="space-y-6">
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="caseId" value={b.case.id} />
            <fieldset disabled={submitted} className="space-y-6 disabled:opacity-70">
              <Panel>
                <label className="block max-w-xs">
                  <span className="mb-1.5 block text-sm font-medium">{d.scheduled}</span>
                  <input type="datetime-local" name="scheduledAt" defaultValue={localInput(b.inspection?.scheduledAt ?? null)} className={inputCls} />
                </label>
              </Panel>
              <Panel title={d.checklist}>
                <div className="space-y-6">
                  {RESIDENTIAL_APARTMENT_CHECKLIST.map((sec) => (
                    <div key={sec.id}>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink2">{dict.inspection.sections[sec.id]}</h3>
                      <ul className="divide-y divide-line rounded-xl border border-line">
                        {sec.items.map((it) => {
                          const v = cl[it.id];
                          return (
                            <li key={it.id} className="grid gap-2 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                              <div>
                                <p className="text-sm font-medium">{dict.inspection.items[it.id as keyof typeof dict.inspection.items]}</p>
                                {it.licensedOnly && <p className="text-[11px] text-warn">{d.licensed}</p>}
                                <div className="mt-1.5 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                  <input name={`note.${it.id}`} defaultValue={v?.note ?? ""} placeholder={d.note} className={`${inputCls} py-1.5 text-sm`} />
                                  <input name={`reading.${it.id}`} defaultValue={v?.reading ?? ""} placeholder={d.reading} className={`${inputCls} py-1.5 text-sm`} />
                                </div>
                              </div>
                              <div className="flex gap-1" role="radiogroup">
                                {(["ok", "issue", "na"] as const).map((s) => (
                                  <label key={s} className="cursor-pointer">
                                    <input type="radio" name={`state.${it.id}`} value={s} defaultChecked={v?.state === s} className="peer sr-only" />
                                    <span className={`block rounded-full border px-3 py-1 text-xs peer-checked:text-white ${s === "ok" ? "peer-checked:border-good peer-checked:bg-good" : s === "issue" ? "peer-checked:border-bad peer-checked:bg-bad" : "peer-checked:border-ink2 peer-checked:bg-ink2"} border-line`}>
                                      {d.states[s]}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <TextArea label={d.summary} name="summary" defaultValue={b.inspection?.summary} rows={4} />
                <p className="mt-3 text-xs text-ink2">{d.submitHint}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SubmitButton variant="secondary" name="intent" value="draft">
                    {d.saveDraft}
                  </SubmitButton>
                  <SubmitButton name="intent" value="submit">
                    {d.submit}
                  </SubmitButton>
                </div>
              </Panel>
            </fieldset>
          </form>

          <Panel title={d.issues}>
            <div id="issues" className="scroll-mt-24" />
            {b.issues.length === 0 ? (
              <p className="text-sm text-ink2">{d.noIssues}</p>
            ) : (
              <ul className="space-y-2">
                {b.issues.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line p-3" style={{ borderLeft: `4px solid var(--${i.severity === "red" ? "bad" : i.severity === "yellow" ? "warn" : "good"})` }}>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {i.title} <span className="text-xs text-ink2">· {dict.inspection.sections[i.sectionId as keyof typeof dict.inspection.sections]}</span>
                      </p>
                      {i.explanation && <p className="text-sm text-ink2">{i.explanation}</p>}
                      <p className="num mt-1 text-xs text-ink2">
                        {i.repairLow !== null ? `${formatMoney(i.repairLow, "UAH", lang)} – ${formatMoney(i.repairHigh ?? i.repairLow, "UAH", lang)} · ` : ""}
                        {e.urgency[i.urgency as keyof typeof e.urgency]} · {e.leverage[i.negotiation as keyof typeof e.leverage]}
                      </p>
                    </div>
                    {!submitted && (
                      <form action={deleteIssueAction}>
                        <input type="hidden" name="lang" value={lang} />
                        <input type="hidden" name="caseId" value={b.case.id} />
                        <input type="hidden" name="issueId" value={i.id} />
                        <SubmitButton variant="danger" className="px-3 py-1 text-xs">
                          {d.delete}
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!submitted && (
              <form action={addIssueAction} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="caseId" value={b.case.id} />
                <p className="font-semibold sm:col-span-2">{d.addIssue}</p>
                {sp.error === "issue" && <p className="text-sm text-bad sm:col-span-2">{dict.auth.errors.generic}</p>}
                <SelectField label={d.section} name="sectionId" options={RESIDENTIAL_APARTMENT_CHECKLIST.map((s) => ({ value: s.id, label: dict.inspection.sections[s.id] }))} />
                <SelectField label={d.severity} name="severity" defaultValue="yellow" options={(["red", "yellow", "green"] as const).map((s) => ({ value: s, label: e.severity[s] }))} />
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">{d.issueTitle}</span>
                  <input name="title" required minLength={2} className={inputCls} />
                </label>
                <div className="sm:col-span-2">
                  <TextArea label={d.explanation} name="explanation" rows={2} />
                </div>
                <SelectField label={d.urgency} name="urgency" defaultValue="within_year" options={(["immediate", "within_year", "monitor"] as const).map((s) => ({ value: s, label: e.urgency[s] }))} />
                <SelectField label={d.negotiation} name="negotiation" defaultValue="medium" options={(["none", "low", "medium", "high"] as const).map((s) => ({ value: s, label: e.leverage[s] }))} />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">{d.repairLow}</span>
                  <input name="repairLow" inputMode="numeric" className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">{d.repairHigh}</span>
                  <input name="repairHigh" inputMode="numeric" className={inputCls} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">{d.assumption}</span>
                  <input name="repairAssumption" className={inputCls} />
                </label>
                <SelectField
                  label={d.specialist}
                  name="specialist"
                  defaultValue="inspector"
                  options={(["inspector", "electrician", "plumber", "engineer", "hvac", "surveyor", "lawyer", "appraiser"] as const).map((s) => ({ value: s, label: dict.inspection.specialistNames[s] }))}
                />
                <div className="flex items-end">
                  <SubmitButton>{d.add}</SubmitButton>
                </div>
              </form>
            )}
          </Panel>
          {can(user.role, "cases.viewAll") && (
            <Link href={`/${lang}/admin/cases/${b.case.id}`} className="text-sm font-semibold text-brand">
              ← {b.number}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
