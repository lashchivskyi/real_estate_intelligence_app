"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { CONTACT_IS_TEST, contactLinks, formatPhone } from "@/config/contact";
import { track } from "@/lib/analytics";
import { motion } from "./motion";
import { useI18n } from "./providers";

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

export function ViberIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M11.4 2C9.3 2 5.4 2.3 3.6 4 2.3 5.3 1.8 7.2 1.8 9.6c0 2.4-.2 6.9 4.2 8.2v1.9s0 .8.5.9c.6.2 1-.4 1.6-1l1.1-1.3c3 .3 5.3-.3 5.6-.4.6-.2 4.1-.6 4.7-5.3.6-4.8-.3-7.9-1.9-9.3C16.9 2.7 14.3 2 11.4 2Zm.2 1.6c2.5 0 4.6.5 5.6 1.4 1.2 1.1 1.9 3.6 1.4 7.6-.5 3.9-3.3 4.1-3.8 4.2-.2.1-2.2.6-4.8.4l-2.5 2.7v-2.9c-3.6-1-3.4-4.7-3.4-6.7 0-2 .4-3.5 1.4-4.5C7 3.8 10.1 3.6 11.6 3.6Zm.4 2.2a.3.3 0 0 0 0 .6 4.5 4.5 0 0 1 4.5 4.6.3.3 0 0 0 .6 0A5.1 5.1 0 0 0 12 5.8Zm-3.4.8a.9.9 0 0 0-.6.1c-.4.3-.9.7-.8 1.1.2.6.6 1.6 1.6 2.9a9.4 9.4 0 0 0 4.4 3.2c.5.1 1-.4 1.3-.8.3-.4.1-.8-.2-1l-1.1-.8c-.4-.3-.8 0-.9.2l-.4.4c-.2.2-.5.2-.5.2-1.9-.5-2.4-2.4-2.4-2.4s0-.3.2-.5l.5-.4c.2-.2.4-.6.1-1l-.8-1.1a.8.8 0 0 0-.4-.1Zm3.6.4a.3.3 0 0 0 0 .6 2.8 2.8 0 0 1 2.7 2.8.3.3 0 0 0 .6 0A3.4 3.4 0 0 0 12.2 7Zm.2 1.3a.3.3 0 0 0 0 .6 1.3 1.3 0 0 1 1.3 1.3.3.3 0 0 0 .6 0 1.9 1.9 0 0 0-1.9-1.9Z" />
    </svg>
  );
}

export function PhoneIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

/** Floating contact dock: phone, WhatsApp, Viber. Expands on click; keyboard and screen-reader friendly. */
export function ContactDock() {
  const { dict } = useI18n();
  const d = dict.contact;
  const [open, setOpen] = useState(false);
  const items = [
    { id: "whatsapp", href: contactLinks.whatsapp, label: "WhatsApp", icon: <WhatsAppIcon />, cls: "bg-[#25D366] text-white" },
    { id: "viber", href: contactLinks.viber, label: "Viber", icon: <ViberIcon />, cls: "bg-[#7360F2] text-white" },
    { id: "phone", href: contactLinks.tel, label: formatPhone(), icon: <PhoneIcon />, cls: "bg-surface text-ink border border-line" },
  ];
  return (
    <div className="no-print fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial="h"
            animate="s"
            exit="h"
            variants={{ s: { transition: { staggerChildren: 0.05 } }, h: { transition: { staggerChildren: 0.03, staggerDirection: -1 } } }}
            className="flex flex-col items-end gap-2"
            id="contact-dock"
          >
            {CONTACT_IS_TEST && (
              <motion.li variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }} className="rounded-lg bg-warnbg px-2.5 py-1 text-[11px] text-ink">
                {d.testNumber}
              </motion.li>
            )}
            {items.map((x) => (
              <motion.li key={x.id} variants={{ h: { opacity: 0, y: 10, scale: 0.9 }, s: { opacity: 1, y: 0, scale: 1 } }}>
                <a
                  href={x.href}
                  target={x.id === "whatsapp" ? "_blank" : undefined}
                  rel="noreferrer"
                  onClick={() => track("consultation_requested", { channel: x.id })}
                  className={`flex items-center gap-2.5 rounded-full py-2 pl-3 pr-4 text-sm font-medium shadow-card transition-transform hover:-translate-x-0.5 ${x.cls}`}
                >
                  {x.icon}
                  {x.label}
                </a>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="contact-dock"
        aria-label={d.open}
        className="group relative grid h-14 w-14 place-items-center rounded-full bg-ink text-bg shadow-card transition-transform hover:scale-105"
      >
        {!open && <span className="absolute inset-0 animate-ping rounded-full bg-brand/30 [animation-duration:2.6s]" aria-hidden />}
        <motion.span animate={{ rotate: open ? 135 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="relative">
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          ) : (
            <PhoneIcon size={20} />
          )}
        </motion.span>
      </button>
    </div>
  );
}
