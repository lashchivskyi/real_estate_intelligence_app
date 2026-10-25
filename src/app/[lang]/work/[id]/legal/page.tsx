import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CaseReference } from "@/components/ops/case-reference";
import { Panel, SubmitButton, TextArea, inputCls } from "@/components/ops/ui";
import { applicableLegalChecks } from "@/domain/legal";
import { getDictionary, isLang } from "@/i18n";
import { reopenLegalAction, saveLegalAction } from "@/server/actions/ops";
import { requireUser } from "@/server/auth";
import { loadCaseFor } from "@/server/cases";

/** Lawyer's working form: one row per applicable registry check (status, note, extract date). */
export default async function LegalFormPage({ params, searchParams }: PageProps<"/[lang]/work/[id]/legal">) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang, { cap: "legal.perform" });
  const b = await loadCaseFor(user, id);
  if (!b || (b.case.lawyerId !== user.id && user.role !== "owner")) redirect(`/${lang}/work`);
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const d = dict.ops.legal;
  const submitted = b.legalReview?.status === "submitted";
  // Items exist once a lawyer is assigned; show the applicable set even before the first save.
  const ids = applicableLegalChecks(b.property.market === "primary" ? "primary" : "secondary");
  const items = ids.map((checkId) => b.legal.find((l) => l.checkId === checkId) ?? { checkId, status: "unknown", note: null, extractDate: null });
  const statuses = ["unknown", "green", "yellow", "red"] as const;
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
          <form action={reopenLegalAction}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="caseId" value={b.case.id} />
            <SubmitButton variant="secondary">{d.reopen}</SubmitButton>
          </form>
        )}
      </div>
      {sp.saved && <p className="rounded-xl bg-goodbg px-4 py-2 text-sm text-good">{sp.saved === "submitted" ? d.submitted : dict.ops.caseDetail.saved}</p>}
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <CaseReference lang={lang} dict={dict} b={b} />
        <form action={saveLegalAction} className="space-y-6">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="caseId" value={b.case.id} />
          <fieldset disabled={submitted} className="space-y-6 disabled:opacity-70">
            <Panel>
              <ul className="divide-y divide-line">
                {items.map((it) => (
                  <li key={it.checkId} className="space-y-2 py-4 first:pt-0 last:pb-0">
                    <p className="font-medium">{dict.report.legal.checks[it.checkId as keyof typeof dict.report.legal.checks]}</p>
                    <div className="flex flex-wrap gap-1">
                      {statuses.map((s) => (
                        <label key={s} className="cursor-pointer">
                          <input type="radio" name={`status.${it.checkId}`} value={s} defaultChecked={it.status === s} className="peer sr-only" />
                          <span className={`block rounded-full border border-line px-3 py-1 text-xs peer-checked:text-white ${s === "green" ? "peer-checked:bg-good" : s === "yellow" ? "peer-checked:bg-warn" : s === "red" ? "peer-checked:bg-bad" : "peer-checked:bg-ink2"}`}>
                            {dict.report.legal.status[s]}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <input name={`note.${it.checkId}`} defaultValue={it.note ?? ""} placeholder={d.note} className={`${inputCls} py-1.5 text-sm`} />
                      <input type="date" name={`date.${it.checkId}`} defaultValue={it.extractDate ?? ""} aria-label={d.extractDate} className={`${inputCls} py-1.5 text-sm`} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <TextArea label={d.summary} name="summary" defaultValue={b.legalReview?.summary} rows={4} />
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
      </div>
    </div>
  );
}
