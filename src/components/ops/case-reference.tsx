import { watchlist } from "@/domain/decision/watchlist";
import { getCityOrDefault } from "@/domain/location/registry";
import { formatMoney, msgText, type Dictionary } from "@/i18n";
import type { Lang } from "@/domain/location/types";
import { toDomainProperty, type CaseBundle } from "@/server/cases";
import { CaseDocuments } from "./case-documents";
import { Panel } from "./ui";

/** The specialist's brief: what the property is, what matters to the client, what to look at, documents. */
export function CaseReference({ lang, dict, b }: { lang: Lang; dict: Dictionary; b: CaseBundle }) {
  const d = dict.ops.work;
  const p = b.property;
  const city = getCityOrDefault(p.cityId);
  const district = city.districts.find((x) => x.id === p.districtId);
  const brief = (b.case.brief ?? {}) as { purpose?: string; household?: string; priorities?: string[] };
  const watch = watchlist(toDomainProperty(p));
  const e = dict.enums;
  const mapHref = p.lat !== null && p.lng !== null ? `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}` : null;
  return (
    <div className="space-y-4">
      <Panel title={d.reference}>
        <p className="font-semibold">{p.address || city.names[lang]}</p>
        <p className="text-sm text-ink2">
          {city.names[lang]}
          {district ? ` · ${district.names[lang]}` : ""}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-ink2">{dict.check.fields.askingPriceShort}</dt>
          <dd className="num">{formatMoney(p.askingPrice, p.currency, lang)}</dd>
          <dt className="text-ink2">{dict.check.fields.area}</dt>
          <dd className="num">{p.areaSqm}</dd>
          <dt className="text-ink2">{dict.check.fields.rooms}</dt>
          <dd className="num">{p.rooms ?? "—"}</dd>
          <dt className="text-ink2">{dict.check.fields.floor}</dt>
          <dd className="num">
            {p.floor ?? "—"}
            {p.floorsTotal ? `/${p.floorsTotal}` : ""}
          </dd>
          <dt className="text-ink2">{dict.check.fields.yearBuilt}</dt>
          <dd className="num">{p.yearBuilt ?? "—"}</dd>
          <dt className="text-ink2">{dict.check.fields.condition}</dt>
          <dd>{p.condition ? e.condition[p.condition as keyof typeof e.condition] : "—"}</dd>
          <dt className="text-ink2">{dict.check.fields.buildingType}</dt>
          <dd>{p.buildingType ? e.buildingType[p.buildingType as keyof typeof e.buildingType] : "—"}</dd>
        </dl>
        {mapHref && (
          <a href={mapHref} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-brand">
            {d.map} ↗
          </a>
        )}
        {p.sourceUrl && (
          <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-brand">
            {p.sourceUrl}
          </a>
        )}
      </Panel>
      <Panel title={d.contact}>
        <p className="text-sm">
          <b>{b.client?.name || b.case.contactName || "—"}</b>
        </p>
        <p className="num text-sm text-ink2">{b.client?.phone || b.case.contactPhone || b.client?.email || b.case.contactEmail || "—"}</p>
        {b.case.clientNote && <p className="mt-2 rounded-lg bg-surface2 p-2 text-sm">{b.case.clientNote}</p>}
      </Panel>
      <Panel title={d.clientBrief}>
        <ul className="space-y-1 text-sm">
          {brief.purpose && <li>· {e.purpose[brief.purpose as keyof typeof e.purpose]}</li>}
          {brief.household && <li>· {e.household[brief.household as keyof typeof e.household]}</li>}
          {(brief.priorities ?? []).map((x) => (
            <li key={x}>· {e.priority[x as keyof typeof e.priority]}</li>
          ))}
          {!brief.purpose && !brief.household && !(brief.priorities ?? []).length && <li className="text-ink2">{dict.ops.caseDetail.noBrief}</li>}
        </ul>
      </Panel>
      {watch.length > 0 && (
        <Panel title={d.watchFor}>
          <ul className="space-y-1.5 text-sm">
            {watch.map((w) => (
              <li key={w.code}>
                <span className="mr-1.5 rounded bg-surface2 px-1.5 text-[11px] text-ink2">{dict.inspection.sections[w.section]}</span>
                {msgText(dict, lang, w)}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <CaseDocuments lang={lang} dict={dict} docs={b.documents} />
    </div>
  );
}
