import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt, sql } from "drizzle-orm";
import { can, type Capability, type Role } from "@/domain/cases";
import { getDb, schema } from "./db";

/**
 * Minimal, dependency-free auth: email + password (scrypt), opaque session token in an httpOnly cookie,
 * only its SHA-256 stored in the DB. Authorization is checked in this data-access layer (not in proxy).
 */
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "vd_session";
const TTL_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(key, expected);
}

const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000);
  const db = await getDb();
  await db.insert(schema.sessions).values({ id: tokenHash(token), userId, expiresAt });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, tokenHash(token)));
  }
  jar.delete(COOKIE);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
}

/** Current user (memoised per request). */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, phone: schema.users.phone, role: schema.users.role, disabled: schema.users.disabled })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, tokenHash(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.disabled) return null;
  return { id: row.id, email: row.email, name: row.name, phone: row.phone, role: row.role as Role };
});

/** Redirects to login when signed out, to /account when the role lacks the capability. */
export async function requireUser(lang: string, opts: { cap?: Capability; roles?: Role[]; next?: string } = {}): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/${lang}/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (opts.cap && !can(user.role, opts.cap)) redirect(`/${lang}/account`);
  if (opts.roles && !opts.roles.includes(user.role)) redirect(`/${lang}/account`);
  return user;
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${email.trim().toLowerCase()}`).limit(1);
  return u ?? null;
}

export async function hasAnyOwner(): Promise<boolean> {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(eq(schema.users.role, "owner"));
  return (r?.n ?? 0) > 0;
}

/** Where a user lands after login. */
export const homeFor = (lang: string, role: Role) =>
  role === "client" ? `/${lang}/account` : role === "inspector" || role === "lawyer" ? `/${lang}/work` : `/${lang}/admin`;
