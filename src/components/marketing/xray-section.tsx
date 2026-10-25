"use client";

import { XrayStory } from "../inspection/xray-story";
import { Reveal } from "../motion";
import { useI18n } from "../providers";

/** Homepage block: why an on-site inspection is worth it, shown in a 3D room. */
export function XraySection() {
  const { dict } = useI18n();
  const d = dict.inspection;
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6" aria-labelledby="xray-title">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{d.xray.eyebrow}</p>
        <h2 id="xray-title" className="display mt-2 max-w-3xl text-[clamp(2rem,4.2vw,3.2rem)]">
          {d.beforeAfterTitle}
        </h2>
        <p className="mt-3 max-w-2xl text-ink2">{d.beforeAfterLead}</p>
      </Reveal>
      <div className="mt-10">
        <XrayStory />
      </div>
    </section>
  );
}
