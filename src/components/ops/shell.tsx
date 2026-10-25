import Link from "next/link";
import type { ReactNode } from "react";
import { can } from "@/domain/cases";
import type { Dictionary } from "@/i18n";
import { logoutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/server/auth";

/** Workspace frame for staff: role-aware navigation, who is signed in, sign-out. */
export function OpsShell({ lang, dict, user, children }: { lang: string; dict: Dictionary; user: SessionUser; children: ReactNode }) {
  const d = dict.ops;
  const links: Array<[string, string]> = [];
  if (can(user.role, "dashboard.view")) links.push([`/${lang}/admin`, d.nav.dashboard]);
  if (can(user.role, "cases.viewAll")) links.push([`/${lang}/admin/cases`, d.nav.cases], [`/${lang}/admin/leads`, d.nav.leads], [`/${lang}/admin/clients`, d.nav.clients]);
  if (can(user.role, "users.manage")) links.push([`/${lang}/admin/team`, d.nav.team]);
  if (can(user.role, "inspection.perform") || can(user.role, "legal.perform")) links.push([`/${lang}/work`, d.nav.work]);
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-line bg-surface p-4 lg:sticky lg:top-24">
        <p className="truncate font-semibold">{user.name || user.email}</p>
        <p className="text-xs text-ink2">{d.roles[user.role]}</p>
        <nav className="mt-4 flex flex-wrap gap-1 lg:flex-col">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-2 text-sm hover:bg-surface2">
              {label}
            </Link>
          ))}
          <Link href={`/${lang}`} className="rounded-lg px-3 py-2 text-sm text-ink2 hover:bg-surface2">
            {d.nav.site}
          </Link>
        </nav>
        <form action={logoutAction} className="mt-3 border-t border-line pt-3">
          <input type="hidden" name="lang" value={lang} />
          <button type="submit" className="text-sm text-ink2 hover:text-ink">
            {dict.auth.logout}
          </button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
