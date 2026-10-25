import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Operational data model. One Postgres schema for every environment:
 * PGlite (embedded, file in .data/) for local/dev, Postgres/Supabase via DATABASE_URL in production.
 *
 *   users ─┬─< sessions
 *          ├─< cases (as client / manager / inspector / lawyer)
 *   properties ─< cases ─┬─ inspections (1:1) ─< inspection_issues
 *                        ├─ legal_items (1 per check id)
 *                        ├─< documents, payments, leads, audit_log
 *   events (analytics funnel)
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    phone: text("phone"),
    /** owner | manager | inspector | lawyer | client — see domain/cases/roles.ts */
    role: text("role").notNull().default("client"),
    passwordHash: text("password_hash").notNull(),
    disabled: boolean("disabled").notNull().default(false),
    lang: text("lang").notNull().default("uk"),
    createdAt: created(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email").on(sql`lower(${t.email})`), index("users_role").on(t.role)],
);

export const sessions = pgTable("sessions", {
  /** sha256 of the cookie token — the token itself is never stored. */
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
});

/** Canonical property record (same fields as domain Property). */
export const properties = pgTable("properties", {
  id: id(),
  cls: text("class").notNull().default("residential"),
  subtype: text("subtype").notNull().default("apartment"),
  cityId: text("city_id").notNull(),
  districtId: text("district_id"),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  market: text("market").notNull().default("secondary"),
  askingPrice: doublePrecision("asking_price").notNull(),
  currency: text("currency").notNull().default("USD"),
  areaSqm: doublePrecision("area_sqm").notNull(),
  rooms: integer("rooms"),
  floor: integer("floor"),
  floorsTotal: integer("floors_total"),
  yearBuilt: integer("year_built"),
  condition: text("condition"),
  buildingType: text("building_type"),
  sourceUrl: text("source_url"),
  createdAt: created(),
});

export const cases = pgTable(
  "cases",
  {
    id: id(),
    /** Human-friendly number, e.g. VD-1001. */
    number: serial("number").notNull(),
    clientId: uuid("client_id").references(() => users.id, { onDelete: "set null" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    packageId: text("package_id").notNull().default("digital"),
    /** new | active | report_ready | closed | cancelled — see domain/cases/workflow.ts */
    status: text("status").notNull().default("new"),
    /** Which modules the client ordered (drives the workflow). */
    legalOrdered: boolean("legal_ordered").notNull().default(false),
    inspectionOrdered: boolean("inspection_ordered").notNull().default(false),
    managerId: uuid("manager_id").references(() => users.id, { onDelete: "set null" }),
    inspectorId: uuid("inspector_id").references(() => users.id, { onDelete: "set null" }),
    lawyerId: uuid("lawyer_id").references(() => users.id, { onDelete: "set null" }),
    /** Client brief snapshot (purpose, household, priorities…). */
    brief: jsonb("brief").$type<Record<string, unknown> | null>(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    clientNote: text("client_note"),
    internalNote: text("internal_note"),
    source: text("source").notNull().default("site"),
    priceUah: integer("price_uah"),
    paid: boolean("paid").notNull().default(false),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cases_client").on(t.clientId), index("cases_status").on(t.status), index("cases_inspector").on(t.inspectorId), index("cases_lawyer").on(t.lawyerId)],
);

export const inspections = pgTable("inspections", {
  caseId: uuid("case_id")
    .primaryKey()
    .references(() => cases.id, { onDelete: "cascade" }),
  inspectorId: uuid("inspector_id").references(() => users.id, { onDelete: "set null" }),
  /** draft | submitted */
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  /** { [itemId]: { state: "ok" | "issue" | "na", note?: string, reading?: string } } */
  checklist: jsonb("checklist").$type<Record<string, { state: "ok" | "issue" | "na"; note?: string; reading?: string }>>().notNull().default({}),
  summary: text("summary"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspectionIssues = pgTable(
  "inspection_issues",
  {
    id: id(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull().default(""),
    urgency: text("urgency").notNull().default("within_year"),
    repairLow: integer("repair_low"),
    repairHigh: integer("repair_high"),
    repairCurrency: text("repair_currency").notNull().default("UAH"),
    repairAssumption: text("repair_assumption"),
    specialist: text("specialist").notNull().default("inspector"),
    negotiation: text("negotiation").notNull().default("low"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("issues_case").on(t.caseId)],
);

export const legalReviews = pgTable("legal_reviews", {
  caseId: uuid("case_id")
    .primaryKey()
    .references(() => cases.id, { onDelete: "cascade" }),
  lawyerId: uuid("lawyer_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"),
  summary: text("summary"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const legalItems = pgTable(
  "legal_items",
  {
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    checkId: text("check_id").notNull(),
    status: text("status").notNull().default("unknown"),
    note: text("note"),
    /** Date of the registry extract this is based on (FACT only with an extract). */
    extractDate: text("extract_date"),
    sourceId: text("source_id").notNull().default("drrp"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.caseId, t.checkId] })],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "cascade" }),
    /** Upload batch from the public form, linked to a case later. */
    batch: text("batch"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    /** client | inspection_photo | registry_extract | report */
    kind: text("kind").notNull().default("client"),
    aiConsent: boolean("ai_consent").notNull().default(false),
    createdAt: created(),
  },
  (t) => [index("documents_case").on(t.caseId), index("documents_batch").on(t.batch)],
);

export const leads = pgTable("leads", {
  id: id(),
  kind: text("kind").notNull(),
  lang: text("lang").notNull().default("uk"),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  note: text("note"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  /** new | contacted | converted | lost */
  status: text("status").notNull().default("new"),
  caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
  createdAt: created(),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey(),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
    packageId: text("package_id"),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    status: text("status").notNull().default("created"),
    amountMinor: integer("amount_minor"),
    currency: text("currency"),
    email: text("email"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_case").on(t.caseId)],
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    props: jsonb("props").$type<Record<string, unknown>>().notNull().default({}),
    path: text("path"),
    createdAt: created(),
  },
  (t) => [index("events_name_time").on(t.name, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: created(),
  },
  (t) => [index("audit_case").on(t.caseId)],
);

export type UserRow = typeof users.$inferSelect;
export type CaseRow = typeof cases.$inferSelect;
export type PropertyRow = typeof properties.$inferSelect;
