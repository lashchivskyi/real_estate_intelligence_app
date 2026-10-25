import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpsShell } from "@/components/ops/shell";
import { STAFF_ROLES } from "@/domain/cases";
import { getDictionary, isLang } from "@/i18n";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const user = await requireUser(lang, { roles: STAFF_ROLES, next: `/${lang}/admin` });
  const dict = await getDictionary(lang);
  return (
    <OpsShell lang={lang} dict={dict} user={user}>
      {children}
    </OpsShell>
  );
}
