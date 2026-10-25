import "server-only";
import { and, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { canViewCase, caseNumber, completeness, deriveStatus, moduleState, packageModules, type CaseModules, type CaseStatus } from "@/domain/cases";
import type { InspectionIssue, NegotiationImpact, SectionId, Severity, SpecialistId, Urgency } from "@/domain/inspection";
import { applicableLegalChecks, type LegalCheck, type LegalCheckId, type LegalStatus } from "@/domain/legal";
import { getCityOrDefault } from "@/domain/location/registry";
import type { ApartmentInput, Property } from "@/domain/property/types";
import type { ReportData } from "@/domain/report/build";
import { getDb, schema } from "./db";
import { assembleForProperty } from "./live-report";

const { cases, properties, users, inspections, inspectionIssues, legalReviews, legalItems, documents, auditLog, leads, payments, events } = schema;

export type Actor = { id: string; role: string } | null;

export async function audit(caseId: string | null, actor: Actor, action: string, meta: Record<string, unknown> = {}) {
  const db = await getDb();
  await db.insert(auditLog).values({ caseId, actorId: actor?.id ?? null, action, meta });
}

/* ------------------------------- create ------------------------------- */

export interface NewCaseInput {
  property: ApartmentInput & { coords?: [number, number] };
  packageId: string;
  brief?: Record<string, unknown> | null;
  contact?: { name?: string; email?: string; phone?: string; note?: string };
  clientId?: string | null;
  source: string;
  priceUah?: number | null;
}

export async function createCase(input: NewCaseInput, actor: Actor = null): Promise<{ id: string; number: string }> {
  const db = await getDb();
  const city = getCityOrDefault(input.property.cityId);
  const p = input.property;
  const [prop] = await db
    .insert(properties)
    .values({
      cityId: city.id,
      districtId: p.districtId ?? null,
      address: p.address ?? null,
      lat: p.coords?.[1] ?? null,
      lng: p.coords?.[0] ?? null,
      market: p.market,
      askingPrice: p.askingPrice,
      currency: city.currency,
      areaSqm: p.areaSqm,
      rooms: p.rooms ?? null,
      floor: p.floor ?? null,
      floorsTotal: p.floorsTotal ?? null,
      yearBuilt: p.yearBuilt ?? null,
      condition: p.condition ?? null,
      buildingType: p.buildingType ?? null,
      sourceUrl: p.sourceUrl ?? null,
    })
    .returning({ id: properties.id });
  // A signed-in client owns the case; otherwise link by e-mail when they register later.
  let clientId = input.clientId ?? null;
  const email = input.contact?.email?.trim().toLowerCase();
  if (!clientId && email) {
    const [u] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email}`, eq(users.role, "client"))).limit(1);
    clientId = u?.id ?? null;
  }
  const mods = packageModules(input.packageId);
  const [c] = await db
    .insert(cases)
    .values({
      propertyId: prop.id,
      clientId,
      packageId: input.packageId,
      legalOrdered: mods.legal,
      inspectionOrdered: mods.inspection,
      brief: input.brief ?? null,
      contactName: input.contact?.name || null,
      contactEmail: email || null,
      contactPhone: input.contact?.phone || null,
      clientNote: input.contact?.note || null,
      source: input.source,
      priceUah: input.priceUah ?? null,
    })
    .returning({ id: cases.id, number: cases.number });
  await audit(c.id, actor, "case.created", { source: input.source, packageId: input.packageId });
  return { id: c.id, number: caseNumber(c.number) };
}

/** Link documents uploaded anonymously (one upload batch) to the case created from the same visit. */
export async function attachBatch(caseId: string, batch: string | null | undefined, actor: Actor = null) {
  if (!batch || !/^[0-9a-f-]{36}$/i.test(batch)) return;
  const db = await getDb();
  const rows = await db.update(documents).set({ caseId }).where(and(eq(documents.batch, batch), isNull(documents.caseId))).returning({ id: documents.id });
  if (rows.length) await audit(caseId, actor, "documents.attached", { count: rows.length });
}

/** Called when a client registers: attach cases left with the same e-mail before they had an account. */
export async function claimCasesByEmail(userId: string, email: string) {
  const db = await getDb();
  await db.update(cases).set({ clientId: userId }).where(and(isNull(cases.clientId), sql`lower(${cases.contactEmail}) = ${email.trim().toLowerCase()}`));
}

/* -------------------------------- read -------------------------------- */

export async function getCaseBundle(caseId: string) {
  const db = await getDb();
  const [row] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  if (!row) return null;
  const [property] = await db.select().from(properties).where(eq(properties.id, row.propertyId)).limit(1);
  const peopleIds = [row.clientId, row.managerId, row.inspectorId, row.lawyerId].filter((x): x is string => !!x);
  const people = peopleIds.length ? await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role }).from(users).where(inArray(users.id, peopleIds)) : [];
  const person = (id: string | null) => people.find((p) => p.id === id) ?? null;
  const [inspection] = await db.select().from(inspections).where(eq(inspections.caseId, caseId)).limit(1);
  const issues = await db.select().from(inspectionIssues).where(eq(inspectionIssues.caseId, caseId)).orderBy(inspectionIssues.createdAt);
  const [legalReview] = await db.select().from(legalReviews).where(eq(legalReviews.caseId, caseId)).limit(1);
  const legal = await db.select().from(legalItems).where(eq(legalItems.caseId, caseId));
  const docs = await db.select().from(documents).where(eq(documents.caseId, caseId)).orderBy(desc(documents.createdAt));
  const log = await db
    .select({ id: auditLog.id, action: auditLog.action, meta: auditLog.meta, createdAt: auditLog.createdAt, actorName: users.name, actorRole: users.role })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(eq(auditLog.caseId, caseId))
    .orderBy(desc(auditLog.createdAt))
    .limit(50);
  const pays = await db.select().from(payments).where(eq(payments.caseId, caseId));
  const modules = modulesOf(row, inspection?.status, legalReview?.status);
  return {
    case: row,
    number: caseNumber(row.number),
    property,
    client: person(row.clientId),
    manager: person(row.managerId),
    inspector: person(row.inspectorId),
    lawyer: person(row.lawyerId),
    inspection: inspection ?? null,
    issues,
    legalReview: legalReview ?? null,
    legal,
    documents: docs,
    audit: log,
    payments: pays,
    modules,
    completeness: completeness(modules),
  };
}
export type CaseBundle = NonNullable<Awaited<ReturnType<typeof getCaseBundle>>>;

function modulesOf(c: typeof cases.$inferSelect, inspectionStatus?: string, legalStatus?: string): CaseModules {
  return {
    digital: "done",
    legal: moduleState({ ordered: c.legalOrdered, assigneeId: c.lawyerId, record: legalStatus === "submitted" ? "submitted" : legalStatus ? "draft" : "none" }),
    technical: moduleState({ ordered: c.inspectionOrdered, assigneeId: c.inspectorId, record: inspectionStatus === "submitted" ? "submitted" : inspectionStatus ? "draft" : "none" }),
  };
}

export async function loadCaseFor(user: { id: string; role: string }, caseId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) return null;
  const b = await getCaseBundle(caseId);
  if (!b || !canViewCase(user, b.case)) return null;
  return b;
}

export interface CaseListRow {
  id: string;
  number: string;
  status: string;
  packageId: string;
  address: string | null;
  cityId: string;
  askingPrice: number;
  currency: string;
  clientName: string | null;
  contactEmail: string | null;
  inspectorId: string | null;
  lawyerId: string | null;
  legalOrdered: boolean;
  inspectionOrdered: boolean;
  paid: boolean;
  createdAt: Date;
  updatedAt: Date;
  modules: CaseModules;
}

export async function listCases(user: { id: string; role: string }, filter: { status?: string; q?: string } = {}): Promise<CaseListRow[]> {
  const db = await getDb();
  const where: SQL[] = [];
  if (user.role === "inspector") where.push(eq(cases.inspectorId, user.id));
  else if (user.role === "lawyer") where.push(eq(cases.lawyerId, user.id));
  else if (user.role === "client") where.push(eq(cases.clientId, user.id));
  if (filter.status) where.push(eq(cases.status, filter.status));
  if (filter.q) {
    const q = `%${filter.q.toLowerCase()}%`;
    where.push(or(sql`lower(coalesce(${properties.address}, '')) like ${q}`, sql`lower(coalesce(${cases.contactEmail}, '')) like ${q}`, sql`lower(coalesce(${cases.contactName}, '')) like ${q}`) as SQL);
  }
  const rows = await db
    .select({
      id: cases.id,
      n: cases.number,
      status: cases.status,
      packageId: cases.packageId,
      address: properties.address,
      cityId: properties.cityId,
      askingPrice: properties.askingPrice,
      currency: properties.currency,
      clientName: cases.contactName,
      contactEmail: cases.contactEmail,
      inspectorId: cases.inspectorId,
      lawyerId: cases.lawyerId,
      legalOrdered: cases.legalOrdered,
      inspectionOrdered: cases.inspectionOrdered,
      paid: cases.paid,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt,
      inspStatus: inspections.status,
      legalStatus: legalReviews.status,
      managerId: cases.managerId,
      clientId: cases.clientId,
    })
    .from(cases)
    .innerJoin(properties, eq(properties.id, cases.propertyId))
    .leftJoin(inspections, eq(inspections.caseId, cases.id))
    .leftJoin(legalReviews, eq(legalReviews.caseId, cases.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(cases.updatedAt))
    .limit(200);
  return rows.map(({ n, inspStatus, legalStatus, managerId, clientId, ...r }) => ({
    ...r,
    number: caseNumber(n),
    modules: modulesOf({ ...r, managerId, clientId } as unknown as typeof cases.$inferSelect, inspStatus ?? undefined, legalStatus ?? undefined),
  }));
}

/* ------------------------------- update ------------------------------- */

/** Re-derive the case status from its modules after any module change. */
export async function syncStatus(caseId: string) {
  const db = await getDb();
  const b = await getCaseBundle(caseId);
  if (!b) return;
  const next = deriveStatus(b.case.status as CaseStatus, b.modules);
  if (next !== b.case.status) {
    await db.update(cases).set({ status: next, updatedAt: new Date() }).where(eq(cases.id, caseId));
    await audit(caseId, null, "case.status", { from: b.case.status, to: next, auto: true });
  }
}

export async function updateCase(
  caseId: string,
  actor: Actor,
  patch: Partial<{ status: CaseStatus; managerId: string | null; inspectorId: string | null; lawyerId: string | null; legalOrdered: boolean; inspectionOrdered: boolean; internalNote: string; paid: boolean }>,
) {
  const db = await getDb();
  const [before] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  if (!before) return;
  await db.update(cases).set({ ...patch, updatedAt: new Date() }).where(eq(cases.id, caseId));
  const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => (before as Record<string, unknown>)[k] !== v));
  if (Object.keys(changed).length) await audit(caseId, actor, "case.updated", changed);
  // Assigning a specialist opens their working record.
  if (patch.inspectorId) await db.insert(inspections).values({ caseId, inspectorId: patch.inspectorId }).onConflictDoUpdate({ target: inspections.caseId, set: { inspectorId: patch.inspectorId } });
  if (patch.lawyerId) {
    await db.insert(legalReviews).values({ caseId, lawyerId: patch.lawyerId }).onConflictDoUpdate({ target: legalReviews.caseId, set: { lawyerId: patch.lawyerId } });
    await ensureLegalItems(caseId);
  }
  if (!patch.status) await syncStatus(caseId);
}

async function ensureLegalItems(caseId: string) {
  const db = await getDb();
  const [row] = await db.select({ market: properties.market }).from(cases).innerJoin(properties, eq(properties.id, cases.propertyId)).where(eq(cases.id, caseId)).limit(1);
  const ids = applicableLegalChecks(row?.market === "primary" ? "primary" : "secondary");
  await db
    .insert(legalItems)
    .values(ids.map((checkId) => ({ caseId, checkId, sourceId: checkId === "permits" ? "eadb" : checkId === "land_plot" ? "land-cadastre" : "drrp" })))
    .onConflictDoNothing();
}

/* ----------------------------- inspection ----------------------------- */

export async function saveInspection(
  caseId: string,
  actor: Actor,
  data: { checklist: Record<string, { state: "ok" | "issue" | "na"; note?: string; reading?: string }>; summary: string; scheduledAt: Date | null },
  submit: boolean,
) {
  const db = await getDb();
  await db
    .insert(inspections)
    .values({ caseId, inspectorId: actor?.id ?? null, checklist: data.checklist, summary: data.summary, scheduledAt: data.scheduledAt })
    .onConflictDoUpdate({
      target: inspections.caseId,
      set: { checklist: data.checklist, summary: data.summary, scheduledAt: data.scheduledAt, updatedAt: new Date(), ...(submit ? { status: "submitted", submittedAt: new Date() } : {}) },
    });
  await audit(caseId, actor, submit ? "inspection.submitted" : "inspection.saved", { items: Object.keys(data.checklist).length });
  if (submit) await syncStatus(caseId);
}

export async function reopenInspection(caseId: string, actor: Actor) {
  const db = await getDb();
  await db.update(inspections).set({ status: "draft", submittedAt: null }).where(eq(inspections.caseId, caseId));
  await audit(caseId, actor, "inspection.reopened");
  await syncStatus(caseId);
}

export async function addIssue(
  caseId: string,
  actor: Actor,
  i: { sectionId: string; severity: string; title: string; explanation: string; urgency: string; repairLow: number | null; repairHigh: number | null; repairAssumption: string; specialist: string; negotiation: string },
) {
  const db = await getDb();
  await db.insert(inspectionIssues).values({ caseId, createdBy: actor?.id ?? null, repairCurrency: "UAH", ...i });
  await audit(caseId, actor, "issue.added", { severity: i.severity, title: i.title });
}

export async function deleteIssue(caseId: string, issueId: string, actor: Actor) {
  const db = await getDb();
  await db.delete(inspectionIssues).where(and(eq(inspectionIssues.id, issueId), eq(inspectionIssues.caseId, caseId)));
  await audit(caseId, actor, "issue.deleted", { issueId });
}

/* -------------------------------- legal -------------------------------- */

export async function saveLegal(caseId: string, actor: Actor, items: Array<{ checkId: string; status: string; note: string; extractDate: string }>, summary: string, submit: boolean) {
  const db = await getDb();
  await ensureLegalItems(caseId);
  for (const it of items) {
    await db
      .update(legalItems)
      .set({ status: it.status, note: it.note || null, extractDate: it.extractDate || null, updatedAt: new Date() })
      .where(and(eq(legalItems.caseId, caseId), eq(legalItems.checkId, it.checkId)));
  }
  await db
    .insert(legalReviews)
    .values({ caseId, lawyerId: actor?.id ?? null, summary })
    .onConflictDoUpdate({ target: legalReviews.caseId, set: { summary, updatedAt: new Date(), ...(submit ? { status: "submitted", submittedAt: new Date() } : {}) } });
  await audit(caseId, actor, submit ? "legal.submitted" : "legal.saved", { items: items.length });
  if (submit) await syncStatus(caseId);
}

export async function reopenLegal(caseId: string, actor: Actor) {
  const db = await getDb();
  await db.update(legalReviews).set({ status: "draft", submittedAt: null }).where(eq(legalReviews.caseId, caseId));
  await audit(caseId, actor, "legal.reopened");
  await syncStatus(caseId);
}

/* ------------------------------ to domain ------------------------------ */

export function toDomainProperty(p: typeof properties.$inferSelect): Property {
  return {
    id: p.id,
    class: (p.cls as Property["class"]) ?? "residential",
    subtype: p.subtype,
    cityId: p.cityId,
    districtId: p.districtId ?? undefined,
    address: p.address ?? undefined,
    coords: p.lat !== null && p.lng !== null ? [p.lng, p.lat] : undefined,
    sourceUrl: p.sourceUrl ?? undefined,
    market: p.market === "primary" ? "primary" : "secondary",
    askingPrice: p.askingPrice,
    currency: p.currency,
    areaSqm: p.areaSqm,
    rooms: p.rooms ?? undefined,
    floor: p.floor ?? undefined,
    floorsTotal: p.floorsTotal ?? undefined,
    yearBuilt: p.yearBuilt ?? undefined,
    condition: (p.condition ?? undefined) as Property["condition"],
    buildingType: (p.buildingType ?? undefined) as Property["buildingType"],
  };
}

const both = (t: string) => ({ uk: t, en: t });

export function toDomainIssues(rows: Array<typeof inspectionIssues.$inferSelect>, asOf: Date | null): InspectionIssue[] {
  return rows.map((r) => ({
    id: r.id,
    sectionId: r.sectionId as SectionId,
    severity: r.severity as Severity,
    title: both(r.title),
    explanation: both(r.explanation),
    urgency: r.urgency as Urgency,
    repair:
      r.repairLow !== null && r.repairHigh !== null
        ? { low: r.repairLow, high: r.repairHigh, currency: r.repairCurrency, assumption: both(r.repairAssumption ?? ""), sourceId: "inspection", confidence: 0.6, asOf: (asOf ?? r.createdAt).toISOString().slice(0, 7) }
        : null,
    specialist: r.specialist as SpecialistId,
    negotiation: r.negotiation as NegotiationImpact,
    photos: [],
  }));
}

export function toDomainLegal(rows: Array<typeof legalItems.$inferSelect>): LegalCheck[] {
  return rows.map((r) => ({
    id: r.checkId as LegalCheckId,
    status: r.status as LegalStatus,
    kind: r.status === "unknown" ? null : r.extractDate ? "FACT" : "INFERENCE",
    sourceId: r.sourceId,
    note: r.note ? both(r.note) : undefined,
    requiresProfessionalReview: true,
  }));
}

/**
 * The report of a case. Repair amounts are entered in UAH; the market (and the report) quotes the
 * city currency, so they are converted at the NBU rate inside the report service.
 */
export async function buildCaseReport(b: CaseBundle): Promise<ReportData> {
  const property = toDomainProperty(b.property);
  const brief = b.case.brief as ReportData["brief"] | null;
  let issues: InspectionIssue[] | null = b.modules.technical === "done" ? toDomainIssues(b.issues, b.inspection?.submittedAt ?? null) : null;
  if (issues && property.currency !== "UAH") {
    const { nbuRate } = await import("./sources/nbu");
    const fx = await nbuRate(property.currency as "USD");
    if (fx)
      issues = issues.map((i) => (i.repair && i.repair.currency === "UAH" ? { ...i, repair: { ...i.repair, low: Math.round(i.repair.low / fx.rate), high: Math.round(i.repair.high / fx.rate), currency: property.currency } } : i));
  }
  return assembleForProperty(property, {
    brief: brief ?? undefined,
    legal: b.modules.legal === "done" ? toDomainLegal(b.legal) : undefined,
    issues,
    modules: { legal: b.modules.legal, technical: b.modules.technical },
    caseRef: { id: b.case.id, number: b.number },
  });
}

/* ------------------------------ dashboard ------------------------------ */

export async function dashboardStats(days = 30) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000);
  const byStatus = await db.select({ status: cases.status, n: sql<number>`count(*)::int` }).from(cases).groupBy(cases.status);
  const byCity = await db.select({ cityId: properties.cityId, n: sql<number>`count(*)::int` }).from(cases).innerJoin(properties, eq(properties.id, cases.propertyId)).groupBy(properties.cityId);
  const byPackage = await db.select({ packageId: cases.packageId, n: sql<number>`count(*)::int` }).from(cases).groupBy(cases.packageId);
  const [newCases] = await db.select({ n: sql<number>`count(*)::int` }).from(cases).where(gte(cases.createdAt, since));
  const [newLeads] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.status, "new"));
  const [revenue] = await db.select({ sum: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::bigint` }).from(payments).where(and(eq(payments.status, "paid"), gte(payments.createdAt, since)));
  const [pipeline] = await db.select({ sum: sql<number>`coalesce(sum(${cases.priceUah}), 0)::int` }).from(cases).where(inArray(cases.status, ["new", "active"]));
  const unassigned = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cases)
    .where(and(inArray(cases.status, ["new", "active"]), or(and(eq(cases.legalOrdered, true), isNull(cases.lawyerId)), and(eq(cases.inspectionOrdered, true), isNull(cases.inspectorId)))));
  const funnelNames = ["brief_started", "brief_completed", "property_added", "report_requested", "report_viewed", "inspection_requested", "consultation_requested", "purchase_completed"];
  const funnel = await db.select({ name: events.name, n: sql<number>`count(*)::int` }).from(events).where(and(gte(events.createdAt, since), inArray(events.name, funnelNames))).groupBy(events.name);
  const recentLeads = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(8);
  const staff = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.role, ["inspector", "lawyer"]));
  const workload = await db
    .select({ inspectorId: cases.inspectorId, lawyerId: cases.lawyerId })
    .from(cases)
    .where(inArray(cases.status, ["new", "active"]));
  return {
    days,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<string, number>,
    byCity,
    byPackage,
    newCases: newCases?.n ?? 0,
    newLeads: newLeads?.n ?? 0,
    revenueUah: Math.round(Number(revenue?.sum ?? 0) / 100),
    pipelineUah: pipeline?.sum ?? 0,
    unassigned: unassigned[0]?.n ?? 0,
    funnel: funnelNames.map((name) => ({ name, n: funnel.find((f) => f.name === name)?.n ?? 0 })),
    recentLeads,
    staffLoad: staff.map((s) => ({ ...s, open: workload.filter((w) => w.inspectorId === s.id || w.lawyerId === s.id).length })),
  };
}

export async function listStaff() {
  const db = await getDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, disabled: users.disabled, lastLoginAt: users.lastLoginAt }).from(users).where(inArray(users.role, ["owner", "manager", "inspector", "lawyer"])).orderBy(users.role, users.name);
}

export async function listClients() {
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, createdAt: users.createdAt, cases: sql<number>`(select count(*)::int from ${cases} where ${cases.clientId} = ${users.id})` })
    .from(users)
    .where(eq(users.role, "client"))
    .orderBy(desc(users.createdAt))
    .limit(200);
}

export async function recordEvent(name: string, props: Record<string, unknown>, path?: string) {
  const db = await getDb();
  await db.insert(events).values({ name, props, path: path ?? null });
}
