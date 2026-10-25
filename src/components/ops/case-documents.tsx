import type { Dictionary } from "@/i18n";
import type { CaseBundle } from "@/server/cases";
import { fmtDate, Panel } from "./ui";

/** Case documents; files are opened through the authenticated /api/files route (never public URLs). */
export function CaseDocuments({ lang, dict, docs }: { lang: string; dict: Dictionary; docs: CaseBundle["documents"] }) {
  const cd = dict.ops.caseDetail;
  return (
    <Panel title={cd.documents}>
      {docs.length === 0 ? (
        <p className="text-sm text-ink2">{cd.noDocuments}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
              <a href={`/api/files/${doc.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-brand hover:underline">
                {doc.name}
              </a>
              <span className="num shrink-0 text-xs text-ink2">
                {Math.max(1, Math.round(doc.size / 1024))} KB · {fmtDate(doc.createdAt, lang)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
