import { notFound } from "next/navigation";
import { fmtDate, Panel, SelectField, SubmitButton, TextField } from "@/components/ops/ui";
import { getDictionary, isLang } from "@/i18n";
import { createStaffAction, toggleUserAction } from "@/server/actions/ops";
import { requireUser } from "@/server/auth";
import { listStaff } from "@/server/cases";

export default async function TeamPage({ params, searchParams }: PageProps<"/[lang]/admin/team">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await requireUser(lang, { cap: "users.manage" });
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const d = dict.ops.team;
  const staff = await listStaff();
  const err = typeof sp.error === "string" ? (sp.error === "exists" ? dict.auth.errors.exists : sp.error === "password" ? dict.auth.errors.weak : dict.auth.errors.generic) : null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">{d.title}</h1>
        <p className="text-sm text-ink2">{d.lead}</p>
      </div>
      <Panel>
        <ul className="divide-y divide-line text-sm">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span>
                <b>{s.name || s.email}</b> <span className="text-ink2">· {dict.ops.roles[s.role as keyof typeof dict.ops.roles]} · {s.email}</span>
                {s.disabled && <span className="ml-2 text-bad">{d.disabled}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="num text-xs text-ink2">
                  {d.lastLogin}: {s.lastLoginAt ? fmtDate(s.lastLoginAt, lang) : d.never}
                </span>
                {s.id !== me.id && (
                  <form action={toggleUserAction}>
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="userId" value={s.id} />
                    <SubmitButton variant={s.disabled ? "secondary" : "danger"} className="px-3 py-1 text-xs">
                      {s.disabled ? d.enable : d.disable}
                    </SubmitButton>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={d.add}>
        {err && <p className="mb-3 rounded-lg bg-badbg px-3 py-2 text-sm text-bad">{err}</p>}
        {sp.created && <p className="mb-3 rounded-lg bg-goodbg px-3 py-2 text-sm text-good">✓</p>}
        <form action={createStaffAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="lang" value={lang} />
          <TextField label={d.name} name="name" required />
          <TextField label={d.email} name="email" type="email" required />
          <SelectField
            label={d.role}
            name="role"
            defaultValue="inspector"
            options={(["inspector", "lawyer", "manager", "owner"] as const).map((r) => ({ value: r, label: dict.ops.roles[r] }))}
          />
          <TextField label={d.tempPassword} name="password" required hint={dict.auth.passwordHint} />
          <div className="sm:col-span-2">
            <SubmitButton>{d.create}</SubmitButton>
          </div>
        </form>
      </Panel>
    </div>
  );
}
