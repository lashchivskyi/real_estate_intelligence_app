"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "./providers";

/** Header entry: "Sign in" or the account / workspace link, resolved after mount and on every navigation. */
export function AccountLink() {
  const { dict, href } = useI18n();
  const [user, setUser] = useState<{ name: string; role: string } | null | undefined>(undefined);
  // Re-check on navigation: the header persists across client-side transitions (e.g. right after sign-in).
  const pathname = usePathname();
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((j: { user: { name: string; role: string } | null }) => setUser(j.user))
      .catch(() => setUser(null));
  }, [pathname]);
  if (user === undefined) return <span className="h-8 w-8" aria-hidden />;
  const target = !user ? "/login" : user.role === "client" ? "/account" : user.role === "inspector" || user.role === "lawyer" ? "/work" : "/admin";
  return (
    <Link href={href(target)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-ink2" title={user?.name}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
      <span className="hidden sm:inline">{user ? dict.auth.account : dict.auth.signIn}</span>
    </Link>
  );
}
