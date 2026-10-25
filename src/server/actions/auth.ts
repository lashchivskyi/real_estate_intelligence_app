"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Role } from "@/domain/cases";
import { isLang } from "@/i18n";
import { createSession, destroySession, findUserByEmail, hashPassword, hasAnyOwner, homeFor, verifyPassword } from "../auth";
import { claimCasesByEmail } from "../cases";
import { getDb, schema } from "../db";

const langOf = (fd: FormData) => {
  const l = String(fd.get("lang") ?? "uk");
  return isLang(l) ? l : "uk";
};
/** Only same-site relative paths are allowed as a post-login destination. */
const safeNext = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
};

export async function loginAction(fd: FormData) {
  const lang = langOf(fd);
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const next = safeNext(fd.get("next"));
  const user = email ? await findUserByEmail(email) : null;
  if (!user || user.disabled || !(await verifyPassword(password, user.passwordHash))) {
    redirect(`/${lang}/login?error=invalid${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  await createSession(user.id);
  redirect(next || homeFor(lang, user.role as Role));
}

const registerSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  consent: z.literal("on"),
});

export async function registerAction(fd: FormData) {
  const lang = langOf(fd);
  const next = safeNext(fd.get("next"));
  const back = (code: string) => redirect(`/${lang}/register?error=${code}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const f = parsed.error.issues[0]?.path[0];
    return back(f === "password" ? "weak" : f === "consent" ? "consent" : "generic");
  }
  if (await findUserByEmail(parsed.data.email)) return back("exists");
  const db = await getDb();
  const [u] = await db
    .insert(schema.users)
    .values({ email: parsed.data.email, name: parsed.data.name, phone: parsed.data.phone || null, role: "client", passwordHash: await hashPassword(parsed.data.password), lang })
    .returning({ id: schema.users.id });
  await claimCasesByEmail(u.id, parsed.data.email);
  await createSession(u.id);
  redirect(next || `/${lang}/account`);
}

/** First-run owner creation; refuses once an owner exists. */
export async function setupAction(fd: FormData) {
  const lang = langOf(fd);
  if (await hasAnyOwner()) redirect(`/${lang}/login?error=setupDone`);
  const parsed = registerSchema.omit({ consent: true }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/${lang}/setup?error=${parsed.error.issues[0]?.path[0] === "password" ? "weak" : "generic"}`);
  const db = await getDb();
  const [u] = await db
    .insert(schema.users)
    .values({ email: parsed.data.email, name: parsed.data.name || "Owner", role: "owner", passwordHash: await hashPassword(parsed.data.password), lang })
    .returning({ id: schema.users.id });
  await createSession(u.id);
  redirect(`/${lang}/admin`);
}

export async function logoutAction(fd: FormData) {
  await destroySession();
  redirect(`/${langOf(fd)}`);
}
