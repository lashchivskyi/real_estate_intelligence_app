import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthCard, SubmitButton, TextField } from "@/components/ops/ui";
import { getDictionary, isLang } from "@/i18n";
import { registerAction } from "@/server/actions/auth";
import { getUser, homeFor } from "@/server/auth";

export const metadata: Metadata = { robots: { index: false } };
// Depends on the database and the session: never prerender.
export const dynamic = "force-dynamic";

export default async function RegisterPage({ params, searchParams }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const user = await getUser();
  if (user) redirect(homeFor(lang, user.role));
  const d = (await getDictionary(lang)).auth;
  const error = typeof sp.error === "string" ? d.errors[sp.error as keyof typeof d.errors] : undefined;
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <AuthCard
      title={d.registerTitle}
      lead={d.registerLead}
      error={error}
      footer={
        <>
          {d.haveAccount}{" "}
          <Link className="font-semibold text-brand" href={`/${lang}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
            {d.submitLogin}
          </Link>
        </>
      }
    >
      <form action={registerAction} className="space-y-4">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="next" value={next} />
        <TextField label={d.name} name="name" autoComplete="name" />
        <TextField label={d.email} name="email" type="email" required autoComplete="email" />
        <TextField label={d.phone} name="phone" type="tel" autoComplete="tel" />
        <TextField label={d.password} name="password" type="password" required autoComplete="new-password" hint={d.passwordHint} />
        <label className="flex items-start gap-2.5 text-sm text-ink2">
          <input type="checkbox" name="consent" required className="mt-1" />
          {d.consent}
        </label>
        <SubmitButton className="w-full py-3">{d.submitRegister}</SubmitButton>
      </form>
    </AuthCard>
  );
}
