import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthCard, SubmitButton, TextField } from "@/components/ops/ui";
import { getDictionary, isLang } from "@/i18n";
import { loginAction } from "@/server/actions/auth";
import { getUser, hasAnyOwner, homeFor } from "@/server/auth";

export const metadata: Metadata = { robots: { index: false } };
// Depends on the database and the session: never prerender.
export const dynamic = "force-dynamic";

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const user = await getUser();
  if (user) redirect(homeFor(lang, user.role));
  if (!(await hasAnyOwner())) redirect(`/${lang}/setup`);
  const d = (await getDictionary(lang)).auth;
  const error = typeof sp.error === "string" ? d.errors[sp.error as keyof typeof d.errors] : undefined;
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <AuthCard
      title={d.loginTitle}
      lead={d.loginLead}
      error={error}
      footer={
        <>
          {d.noAccount}{" "}
          <Link className="font-semibold text-brand" href={`/${lang}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
            {d.submitRegister}
          </Link>
        </>
      }
    >
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="next" value={next} />
        <TextField label={d.email} name="email" type="email" required autoComplete="email" />
        <TextField label={d.password} name="password" type="password" required autoComplete="current-password" />
        <SubmitButton className="w-full py-3">{d.submitLogin}</SubmitButton>
      </form>
    </AuthCard>
  );
}
