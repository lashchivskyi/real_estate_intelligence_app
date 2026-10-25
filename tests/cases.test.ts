import { describe, expect, it } from "vitest";
import { can, canViewCase, completeness, deriveStatus, moduleState, packageModules } from "@/domain/cases";

describe("case workflow", () => {
  it("module state from order/assignment/record", () => {
    expect(moduleState({ ordered: false, assigneeId: null, record: "none" })).toBe("not_ordered");
    expect(moduleState({ ordered: true, assigneeId: null, record: "none" })).toBe("awaiting_assignment");
    expect(moduleState({ ordered: true, assigneeId: "u1", record: "draft" })).toBe("in_progress");
    expect(moduleState({ ordered: true, assigneeId: "u1", record: "submitted" })).toBe("done");
  });
  it("status is derived from modules; terminal states stick", () => {
    expect(deriveStatus("new", { digital: "done", legal: "not_ordered", technical: "not_ordered" })).toBe("new");
    expect(deriveStatus("new", { digital: "done", legal: "in_progress", technical: "not_ordered" })).toBe("active");
    expect(deriveStatus("active", { digital: "done", legal: "done", technical: "done" })).toBe("report_ready");
    expect(deriveStatus("closed", { digital: "done", legal: "in_progress", technical: "done" })).toBe("closed");
    expect(completeness({ digital: "done", legal: "done", technical: "not_ordered" })).toEqual({ done: 2, total: 3 });
  });
  it("packages map to modules", () => {
    expect(packageModules("full")).toEqual({ legal: true, inspection: true });
    expect(packageModules("legal")).toEqual({ legal: true, inspection: false });
    expect(packageModules("digital")).toEqual({ legal: false, inspection: false });
  });
  it("permissions: specialists only see assigned cases, clients only their own", () => {
    const c = { clientId: "c1", inspectorId: "i1", lawyerId: "l1", managerId: "m1" };
    expect(canViewCase({ id: "i1", role: "inspector" }, c)).toBe(true);
    expect(canViewCase({ id: "i2", role: "inspector" }, c)).toBe(false);
    expect(canViewCase({ id: "c2", role: "client" }, c)).toBe(false);
    expect(canViewCase({ id: "x", role: "manager" }, c)).toBe(true);
    expect(can("lawyer", "inspection.perform")).toBe(false);
    expect(can("owner", "users.manage")).toBe(true);
  });
});
