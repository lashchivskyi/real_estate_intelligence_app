"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { can, CASE_STATUSES, ROLES, type CaseStatus } from "@/domain/cases";
import { RESIDENTIAL_APARTMENT_CHECKLIST } from "@/domain/inspection";
import { applicableLegalChecks } from "@/domain/legal";
import { apartmentInputSchema } from "@/domain/property/types";
import { isLang } from "@/i18n";
import { briefFromParams, paramsToInput } from "@/lib/report-service";
import { hashPassword, requireUser, findUserByEmail } from "../auth";
import { addIssue, audit, createCase, deleteIssue, loadCaseFor, reopenInspection, reopenLegal, saveInspection, saveLegal, updateCase } from "../cases";
import { getDb, schema } from "../db";

const langOf = (fd: FormData) => {
  const l = String(fd.get("lang") ?? "uk");
  return isLang(l) ? l : "uk";
};
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const uuidOrNull = (v: string) => (/^[0-9a-f-]{36}$/i.test(v) ? v : null);

/* ----------------------------- case manager ----------------------------- */

export async function updateCaseAction(fd: FormData) {
  const lang = langOf(fd);
  const caseId = str(fd, "caseId");
  const user = await requireUser(lang, { cap: "cases.manage" });
  const status = str(fd, "status") as CaseStatus;
  await updateCase(caseId, user, {
    managerId: uuidOrNull(str(fd, "managerId")),
    inspectorId: uuidOrNull(str(fd, "inspectorId")),
    lawyerId: uuidOrNull(str(fd, "lawyerId")),
    legalOrdered: fd.get("legalOrdered") === "on",
    inspectionOrdered: fd.get("inspectionOrdered") === "on",
    paid: fd.get("paid") === "on",
    internalNote: str(fd, "internalNote"),
    // Only terminal states are set by hand; the rest is derived from the modules.
    ...(status === "closed" || status === "cancelled" ? { status } : {}),
  });
  if (status !== "closed" && status !== "cancelled" && (CASE_STATUSES as string[]).includes(status)) {
    const db = await getDb();
    const [c] = await db.select({ status: schema.cases.status }).from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
    // Re-opening a closed/cancelled case: back to "new" and let derivation take over.
    if (c && (c.status === "closed" || c.status === "cancelled")) {
      await updateCase(caseId, user, { status: "new" });
    }
  }
  revalidatePath(`/${lang}/admin/cases/${caseId}`);
  redirect(`/${lang}/admin/cases/${caseId}?saved=1`);
}

export async function setLeadStatusAction(fd: FormData) {
  const lang = langOf(fd);
  await requireUser(lang, { cap: "cases.manage" });
  const id = uuidOrNull(str(fd, "leadId"));
  const status = str(fd, "status");
  if (id && ["new", "contacted", "converted", "lost"].includes(status)) {
    const db = await getDb();
    await db.update(schema.leads).set({ status }).where(eq(schema.leads.id, id));
  }
  revalidatePath(`/${lang}/admin/leads`);
}

/* --------------------------------- team --------------------------------- */

export async function createStaffAction(fd: FormData) {
  const lang = langOf(fd);
  await requireUser(lang, { cap: "users.manage" });
  const parsed = z
    .object({ email: z.string().trim().email(), name: z.string().trim().min(1).max(120), role: z.enum(["manager", "inspector", "lawyer", "owner"]), password: z.string().min(8).max(200) })
    .safeParse({ email: str(fd, "email"), name: str(fd, "name"), role: str(fd, "role"), password: String(fd.get("password") ?? "") });
  if (!parsed.success) redirect(`/${lang}/admin/team?error=${String(parsed.error.issues[0]?.path[0] ?? "invalid")}`);
  if (await findUserByEmail(parsed.data.email)) redirect(`/${lang}/admin/team?error=exists`);
  const db = await getDb();
  await db.insert(schema.users).values({ email: parsed.data.email, name: parsed.data.name, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) });
  redirect(`/${lang}/admin/team?created=1`);
}

export async function toggleUserAction(fd: FormData) {
  const lang = langOf(fd);
  const me = await requireUser(lang, { cap: "users.manage" });
  const id = uuidOrNull(str(fd, "userId"));
  if (id && id !== me.id) {
    const db = await getDb();
    const [u] = await db.select({ disabled: schema.users.disabled, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (u && (ROLES as readonly string[]).includes(u.role)) {
      await db.update(schema.users).set({ disabled: !u.disabled }).where(eq(schema.users.id, id));
      if (!u.disabled) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    }
  }
  revalidatePath(`/${lang}/admin/team`);
}

/* ------------------------------ inspection ------------------------------ */

async function specialistCase(lang: string, caseId: string, kind: "inspection" | "legal") {
  const user = await requireUser(lang, { cap: kind === "inspection" ? "inspection.perform" : "legal.perform" });
  const b = await loadCaseFor(user, caseId);
  // Owners can act on any case; specialists only on the ones assigned to them.
  const assigned = kind === "inspection" ? b?.case.inspectorId === user.id : b?.case.lawyerId === user.id;
  if (!b || (!assigned && user.role !== "owner")) redirect(`/${lang}/work`);
  return { user, b };
}

export async function saveInspectionAction(fd: FormData) {
  const lang = langOf(fd);
  const caseId = str(fd, "caseId");
  const { user } = await specialistCase(lang, caseId, "inspection");
  const checklist: Record<string, { state: "ok" | "issue" | "na"; note?: string; reading?: string }> = {};
  for (const sec of RESIDENTIAL_APARTMENT_CHECKLIST) {
    for (const it of sec.items) {
      const state = str(fd, `state.${it.id}`);
      if (state === "ok" || state === "issue" || state === "na") checklist[it.id] = { state, note: str(fd, `note.${it.id}`) || undefined, reading: str(fd, `reading.${it.id}`) || undefined };
    }
  }
  const when = str(fd, "scheduledAt");
  const submit = str(fd, "intent") === "submit";
  await saveInspection(caseId, user, { checklist, summary: str(fd, "summary"), scheduledAt: when ? new Date(when) : null }, submit);
  revalidatePath(`/${lang}/work/${caseId}/inspection`);
  redirect(`/${lang}/work/${caseId}/inspection?saved=${submit ? "submitted" : "draft"}`);
}

export async function reopenInspectionAction(fd: FormData) {
  const lang = langOf(fd);
  const caseId = str(fd, "caseId");
  const { user } = await specialistCase(lang, caseId, "inspection");
  await reopenInspection(caseId, user);
  redirect(`/${lang}/work/${caseId}/inspection`);
}

const issueSchema = z.object({
  sectionId: z.string().min(1),
  severity: z.enum(["red", "yellow", "green"]),
  title: z.string().trim().min(2).max(200),
  explanation: z.string().trim().max(2000).default(""),
  urgency: z.enum(["immediate", "within_year", "monitor"]),
  repairLow: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(0).max(100_000_000).nullable()),
  repairHigh: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(0).max(100_000_000).nullable()),
  repairAssumption: z.string().trim().max(500).default(""),
  specialist: z.enum(["inspector", "lawyer", "surveyor", "electrician", "engineer", "plumber", "hvac", "appraiser"]),
  negotiation: z.enum(["none", "low", "medium", "high"]),
});

export async function addIssueAction(fd: FormData) {
  const lang = langOf(fd);
  const caseId = str(fd, "caseId");
  const { user } = await specialistCase(lang, caseId, "inspection");
  const raw = Object.fromEntries(["sectionId", "severity", "title", "explanation", "urgency", "repairLow", "repairHigh", "repairAssumption", "specialist", "negotiation"].map((k) => [k, str(fd, k)]));
  const parsed = issueSchema.safeParse(raw);
  if (parsed.success) {
    const d = parsed.data;
    // A range must be ordered; a single number becomes a point range.
    const lo = d.repairLow ?? d.repairHigh;
    const hi = d.repairHigh ?? d.repairLow;
    await addIssue(caseId, user, { ...d, repairLow: lo !== null && hi !== null ? Math.min(lo, hi) : null, repairHigh: lo !== null && hi !== null ? Math.max(lo, hi) : null });
  }
  redirect(`/${lang}/work/${caseId}/inspection${parsed.success ? "" : "?error=issue"}#issues`);
}

export async function deleteIssueAction(fd: FormData) {
  const lang = langOf(fd);
  const caseId = str(fd, "caseId");
  const { user } = await specialistCase(lang, caseId, "inspection");
  await deleteIssue(caseId, str(fd, "issueId"), user);
  redirect(`/${lang}/work/${caseId}/inspection#issues`);
}

/* --------------------------------- legal --------------------------------- */

export async function saveLegalAction(fd: FormData) {
  const lang = langOf(fd);
  const caseId = str(fd, "caseId");
  const { user, b } = await specialistCase(lang, caseId, "legal");
  const ids = applicableLegalChecks(b.property.market === "primary" ? "primary" : "secondary");
  const items = ids.map((checkId) => {
    const status = str(fd, `status.${checkId}`);
    return { checkId, status: ["green", "yellow", "red", "unknown"].includes(status) ? status : "unknown", note: str(fd, `note.${checkId}`), extractDate: str(fd, `date.${checkId}`) };
  });
  const submit = str(fd, "intent") === "submit";
  await saveLegal(caseId, user, items, str(fd, "summary"), submit);
  revalidatePath(`/${lang}/work/${caseId}/legal`);
  redirect(`/${lang}/work/${caseId}/legal?saved=${submit ? "submitted" : "draft"}`);
}

export async function reopenLegalAction(fd: FormData) {
  const lang = langOf(fd);
  const caseId = str(fd, "caseId");
  const { user } = await specialistCase(lang, caseId, "legal");
  await reopenLegal(caseId, user);
  redirect(`/${lang}/work/${caseId}/legal`);
}

/* ------------------------------ client side ------------------------------ */

/** "Save to my account" from an anonymous report: creates a digital-only case owned by the client. */
export async function saveReportToAccountAction(fd: FormData) {
  const lang = langOf(fd);
  const query = str(fd, "query");
  const user = await requireUser(lang, { next: `/${lang}/report?${query}` });
  const sp = Object.fromEntries(new URLSearchParams(query));
  const parsed = apartmentInputSchema.safeParse(paramsToInput(sp));
  if (!parsed.success) redirect(`/${lang}/check`);
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const c = await createCase(
    {
      property: { ...parsed.data, coords: Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : undefined },
      packageId: "digital",
      brief: (briefFromParams(sp) as Record<string, unknown> | undefined) ?? null,
      contact: { name: user.name, email: user.email, phone: user.phone ?? undefined },
      clientId: user.role === "client" ? user.id : null,
      source: "report",
    },
    user,
  );
  redirect(`/${lang}/cases/${c.id}`);
}

/** Client adds a module (legal / inspection) to an existing case → a request for the manager. */
export async function requestModuleAction(fd: FormData) {
  const lang = langOf(fd);
  const caseId = str(fd, "caseId");
  const mod = str(fd, "module");
  const user = await requireUser(lang);
  const b = await loadCaseFor(user, caseId);
  if (!b) redirect(`/${lang}/account`);
  if (mod === "legal" || mod === "inspection") {
    const db = await getDb();
    await db
      .update(schema.cases)
      .set(mod === "legal" ? { legalOrdered: true, updatedAt: new Date() } : { inspectionOrdered: true, updatedAt: new Date() })
      .where(and(eq(schema.cases.id, caseId)));
    await db.insert(schema.leads).values({ kind: mod, lang, name: user.name, email: user.email, phone: user.phone, caseId, payload: { requestedBy: can(user.role, "cases.manage") ? "staff" : "client" } });
    await audit(caseId, user, "case.updated", { [mod === "legal" ? "legalOrdered" : "inspectionOrdered"]: true });
  }
  redirect(`/${lang}/cases/${caseId}?requested=${mod}`);
}
