import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthCard, SubmitButton, TextField } from "@/components/ops/ui";
import { getDictionary, isLang } from "@/i18n";
import { setupAction } from "@/server/actions/auth";
import { hasAnyOwner } from "@/server/auth";

export const metadata: Metadata = { robots: { index: false } };
// Depends on the database and the session: never prerender.
export const dynamic = "force-dynamic";

/** First-run only: creates the owner account. */
export default async function SetupPage({ params, searchParams }: PageProps<"/[lang]/setup">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  if (await hasAnyOwner()) redirect(`/${lang}/login`);
  const sp = await searchParams;
  const d = (await getDictionary(lang)).auth;
  const error = typeof sp.error === "string" ? d.errors[sp.error as keyof typeof d.errors] : undefined;
  return (
    <AuthCard title={d.setupTitle} lead={d.setupLead} error={error}>
      <form action={setupAction} className="space-y-4">
        <input type="hidden" name="lang" value={lang} />
        <TextField label={d.name} name="name" autoComplete="name" />
        <TextField label={d.email} name="email" type="email" required autoComplete="email" />
        <TextField label={d.password} name="password" type="password" required autoComplete="new-password" hint={d.passwordHint} />
        <SubmitButton className="w-full py-3">{d.submitSetup}</SubmitButton>
      </form>
    </AuthCard>
  );
}
