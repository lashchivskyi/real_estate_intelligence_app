import { describe, expect, it } from "vitest";
import { addIssue, buildCaseReport, createCase, getCaseBundle, listCases, saveInspection, saveLegal, updateCase } from "@/server/cases";
import { getDb, schema } from "@/server/db";

/** End-to-end workflow on an in-memory Postgres (PGlite): case → assignments → inspection → legal → report. */
describe("operations workflow", () => {
  it("runs a case through all modules and the report reflects each step", async () => {
    const db = await getDb();
    const [insp] = await db.insert(schema.users).values({ email: "insp@t.co", name: "Insp", role: "inspector", passwordHash: "x" }).returning();
    const [law] = await db.insert(schema.users).values({ email: "law@t.co", name: "Law", role: "lawyer", passwordHash: "x" }).returning();
    const c = await createCase({ property: { cityId: "lviv", market: "secondary", askingPrice: 97000, areaSqm: 62, rooms: 2, districtId: "frankivskyi" }, packageId: "full", source: "test", contact: { email: "client@t.co" } });
    expect(c.number).toMatch(/^VD-\d+$/);

    let b = (await getCaseBundle(c.id))!;
    expect(b.modules).toEqual({ digital: "done", legal: "awaiting_assignment", technical: "awaiting_assignment" });
    expect(b.case.status).toBe("new");

    await updateCase(c.id, null, { inspectorId: insp.id, lawyerId: law.id });
    b = (await getCaseBundle(c.id))!;
    expect(b.case.status).toBe("active");
    expect(b.legal.length).toBe(6);

    // a draft inspection with a finding must NOT reach the report
    await addIssue(c.id, insp, { sectionId: "electrical", severity: "red", title: "Щит без УЗО", explanation: "", urgency: "immediate", repairLow: 60000, repairHigh: 120000, repairAssumption: "", specialist: "electrician", negotiation: "high" });
    await saveInspection(c.id, insp, { checklist: { panel: { state: "issue" } }, summary: "", scheduledAt: null }, false);
    let report = await buildCaseReport((await getCaseBundle(c.id))!);
    expect(report.issues).toBeNull();
    expect(report.overall.stage).toBe("preliminary");

    await saveInspection(c.id, insp, { checklist: { panel: { state: "issue" } }, summary: "done", scheduledAt: null }, true);
    await saveLegal(c.id, law, b.legal.map((l) => ({ checkId: l.checkId, status: "green", note: "", extractDate: "2026-10-20" })), "clean", true);
    b = (await getCaseBundle(c.id))!;
    expect(b.case.status).toBe("report_ready");
    report = await buildCaseReport(b);
    expect(report.overall.stage).toBe("complete");
    expect(report.issues?.[0].repair?.currency).toBe(report.property.currency);
    expect(report.legal.every((l) => l.kind === "FACT")).toBe(true);

    // specialists only see their own cases
    expect((await listCases(insp)).map((r) => r.id)).toContain(c.id);
    expect(await listCases({ id: "00000000-0000-0000-0000-000000000000", role: "inspector" })).toHaveLength(0);
  });
});
