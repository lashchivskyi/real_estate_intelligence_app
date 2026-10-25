import Link from "next/link";
import { listCities } from "@/domain/location/registry";
import type { Lang } from "@/domain/location/types";
import { fmt, type Dictionary } from "@/i18n";
import { Logo } from "./site-header";
import { PhoneIcon, ViberIcon, WhatsAppIcon } from "./contact-dock";
import { CONTACT_IS_TEST, contactLinks, formatPhone } from "@/config/contact";

export function SiteFooter({ lang, dict }: { lang: Lang; dict: Dictionary }) {
  const h = (p: string) => `/${lang}${p}`;
  return (
    <footer role="contentinfo" className="mt-24 border-t border-line bg-surface2/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-ink2">{dict.footer.tag}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <a href={contactLinks.tel} className="num inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 font-medium hover:border-ink2">
              <PhoneIcon size={15} /> {formatPhone()}
            </a>
            <a href={contactLinks.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white">
              <WhatsAppIcon size={18} />
            </a>
            <a href={contactLinks.viber} aria-label="Viber" className="grid h-9 w-9 place-items-center rounded-full bg-[#7360F2] text-white">
              <ViberIcon size={18} />
            </a>
            {CONTACT_IS_TEST && <span className="text-xs text-ink2">{dict.contact.testNumber}</span>}
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink2">{dict.footer.product}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={h("/check")}>{dict.nav.check}</Link></li>
            <li><Link href={h("/brief")}>{dict.nav.brief}</Link></li>
            <li><Link href={h("/compare")}>{dict.nav.compare}</Link></li>
            <li><Link href={h("/report/sample")}>{dict.nav.sample}</Link></li>
            <li><Link href={h("/methodology")}>{dict.nav.methodology}</Link></li>
            <li><Link href={h("/services")}>{dict.nav.services}</Link></li>
            <li><Link href={h("/brand")}>{dict.nav.brand}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink2">{dict.footer.cities}</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {listCities().map((c) => (
              <li key={c.id}>
                {c.names[lang]}
                {c.marketKind === "resort" && <span className="ml-2 text-xs text-ink2">· {dict.nav.resort}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ink2 sm:px-6 md:flex-row md:justify-between">
          <p className="max-w-3xl">{dict.footer.legal}</p>
          <p>{fmt(dict.footer.rights, { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
