/**
 * Case = one property being checked for one client. The dossier has three INDEPENDENT modules:
 *   digital  — automatic (price, location, investment); always available
 *   legal    — registry review by a lawyer (ordered separately)
 *   technical — on-site inspection by an inspector (ordered separately)
 * Each module has its own lifecycle; the case status and the final verdict are DERIVED from them,
 * so a missing module never "poisons" the modules that are done.
 */

export const ROLES = ["owner", "manager", "inspector", "lawyer", "client"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: Role[] = ["owner", "manager", "inspector", "lawyer"];
export const isStaff = (r: string): r is Role => (STAFF_ROLES as string[]).includes(r);

export type Capability =
  | "dashboard.view" // owner analytics
  | "cases.viewAll"
  | "cases.manage" // assign, change status, notes
  | "users.manage"
  | "inspection.perform"
  | "legal.perform";

const CAPS: Record<Role, Capability[]> = {
  owner: ["dashboard.view", "cases.viewAll", "cases.manage", "users.manage", "inspection.perform", "legal.perform"],
  manager: ["dashboard.view", "cases.viewAll", "cases.manage"],
  inspector: ["inspection.perform"],
  lawyer: ["legal.perform"],
  client: [],
};
export const can = (role: string, cap: Capability) => (CAPS[role as Role] ?? []).includes(cap);

/** Who may open a case: staff with cases.viewAll, the assigned specialist, or the client who owns it. */
export function canViewCase(user: { id: string; role: string }, c: { clientId: string | null; inspectorId: string | null; lawyerId: string | null; managerId: string | null }): boolean {
  if (can(user.role, "cases.viewAll")) return true;
  if (user.role === "inspector") return c.inspectorId === user.id;
  if (user.role === "lawyer") return c.lawyerId === user.id;
  if (user.role === "client") return c.clientId === user.id;
  return false;
}

export type ModuleState = "not_ordered" | "awaiting_assignment" | "in_progress" | "done";
export type CaseStatus = "new" | "active" | "report_ready" | "closed" | "cancelled";
export const CASE_STATUSES: CaseStatus[] = ["new", "active", "report_ready", "closed", "cancelled"];

export interface ModuleInput {
  ordered: boolean;
  assigneeId: string | null;
  /** draft/submitted record exists */
  record: "none" | "draft" | "submitted";
}

export function moduleState(m: ModuleInput): ModuleState {
  if (m.record === "submitted") return "done";
  if (!m.ordered) return "not_ordered";
  if (!m.assigneeId) return "awaiting_assignment";
  return "in_progress";
}

export interface CaseModules {
  digital: "done";
  legal: ModuleState;
  technical: ModuleState;
}

/** Derived status: manual terminal states win; otherwise computed from modules. */
export function deriveStatus(current: CaseStatus, modules: CaseModules): CaseStatus {
  if (current === "closed" || current === "cancelled") return current;
  const ordered = [modules.legal, modules.technical].filter((s) => s !== "not_ordered");
  if (ordered.length > 0 && ordered.every((s) => s === "done")) return "report_ready";
  if (ordered.some((s) => s === "in_progress" || s === "done")) return "active";
  return current === "report_ready" ? "active" : current;
}

/** 0..1 how complete the dossier is (digital always counts). */
export function completeness(modules: CaseModules): { done: number; total: number } {
  const list = [modules.digital, modules.legal, modules.technical];
  return { done: list.filter((s) => s === "done").length, total: list.length };
}

/** Package → which modules it includes (mirrors config/packages.ts). */
export function packageModules(packageId: string): { legal: boolean; inspection: boolean } {
  switch (packageId) {
    case "full":
    case "advisory":
    case "commercial":
      return { legal: true, inspection: true };
    case "legal":
      return { legal: true, inspection: false };
    case "inspection":
      return { legal: false, inspection: true };
    default:
      return { legal: false, inspection: false };
  }
}

export const caseNumber = (n: number) => `VD-${1000 + n}`;
