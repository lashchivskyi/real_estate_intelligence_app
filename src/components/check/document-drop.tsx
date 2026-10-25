"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { AnimatePresence } from "motion/react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { motion } from "../motion";
import { useI18n } from "../providers";
import { Button } from "../ui/primitives";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic";
const MAX_FILES = 10;
const MAX_MB = 15;
const BATCH_KEY = "bi.uploadBatch";

interface Item {
  id: string;
  file: File;
  preview?: string;
}

/** Re-encode JPEG/PNG/WEBP in the browser to strip EXIF (incl. GPS) before upload. PDFs/HEIC pass through. */
async function stripMetadata(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.92));
    return blob ? new File([blob], file.name, { type }) : file;
  } catch {
    return file;
  }
}

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Private document/photo intake: drag & drop, previews, client-side checks, EXIF stripping,
 * upload progress, explicit consent (+ separate opt-in for AI extraction). Files go to a private
 * bucket; nothing is public, nothing is used for model training.
 */
export function DocumentDrop({ caseId }: { caseId?: string } = {}) {
  const { dict } = useI18n();
  const d = dict.uploads;
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [consent, setConsent] = useState(false);
  const [ai, setAi] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "done" | "notConfigured" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), [items]);

  const add = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const next: Item[] = [];
    for (const f of Array.from(list)) {
      if (items.length + next.length >= MAX_FILES) {
        setError(d.errors.count.replace("{n}", String(MAX_FILES)));
        break;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(d.errors.size.replace("{name}", f.name).replace("{mb}", String(MAX_MB)));
        continue;
      }
      next.push({ id: `${f.name}-${f.size}-${f.lastModified}`, file: f, preview: f.type.startsWith("image/") && f.type !== "image/heic" ? URL.createObjectURL(f) : undefined });
    }
    setItems((cur) => [...cur, ...next.filter((n) => !cur.some((c) => c.id === n.id))]);
    setState("idle");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    add(e.dataTransfer.files);
  };

  async function upload() {
    if (!consent || items.length === 0) return;
    setError(null);
    setProgress(0);
    const fd = new FormData();
    for (const it of items) fd.append("files", await stripMetadata(it.file));
    fd.append("consent", "true");
    fd.append("aiConsent", String(ai));
    if (caseId) fd.append("caseId", caseId);
    // XHR for real upload progress (fetch has no upload progress events).
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let j: { batch?: string; error?: string } = {};
      try {
        j = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status === 200 && j.batch) {
        try {
          localStorage.setItem(BATCH_KEY, j.batch);
        } catch {
          /* ignore */
        }
        track("property_added", { source: "documents", files: items.length });
        setState("done");
        if (caseId) window.location.reload();
      } else if (xhr.status === 503) setState("notConfigured");
      else {
        setState("error");
        setError(d.errors[(j.error as keyof typeof d.errors) ?? "generic"] ?? d.errors.generic);
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setState("error");
      setError(d.errors.generic);
    };
    xhr.send(fd);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{d.title}</p>
          <p className="mt-1 max-w-2xl text-sm text-ink2">{d.lead}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1 text-xs font-medium">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          {d.private}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn("mt-5 grid place-items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-brand bg-brand/5" : "border-line")}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.6" aria-hidden>
          <path d="M12 16V4M7 9l5-5 5 5" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <p className="mt-3 font-medium">{d.drop}</p>
        <p className="mt-1 text-xs text-ink2">{d.limits.replace("{n}", String(MAX_FILES)).replace("{mb}", String(MAX_MB))}</p>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => input.current?.click()}>
          {d.choose}
        </Button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => add(e.target.files)} aria-label={d.choose} />
      </div>

      <p className="mt-3 text-xs text-ink2">{d.examples}</p>

      <AnimatePresence initial={false}>
        {items.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-5 grid gap-2 sm:grid-cols-2">
            {items.map((it) => (
              <motion.li key={it.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                {it.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={it.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-lg bg-surface2 text-[11px] font-bold text-ink2">{it.file.name.split(".").pop()?.toUpperCase().slice(0, 4)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{it.file.name}</span>
                  <span className="num block text-xs text-ink2">{fmtSize(it.file.size)}</span>
                </span>
                <button type="button" onClick={() => setItems((c) => c.filter((x) => x.id !== it.id))} aria-label={d.remove} className="grid h-8 w-8 place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
                  ✕
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <div className="mt-5 space-y-2.5 text-sm">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{d.consent}</span>
        </label>
        <label className="flex items-start gap-2.5 text-ink2">
          <input type="checkbox" className="mt-1" checked={ai} onChange={(e) => setAi(e.target.checked)} />
          <span>{d.aiConsent}</span>
        </label>
      </div>

      {progress !== null && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={upload} disabled={!consent || items.length === 0 || progress !== null}>
          {progress !== null ? `${d.uploading} ${progress}%` : d.upload}
        </Button>
        <p aria-live="polite" className="text-sm">
          {state === "done" && <span className="text-good">{d.done}</span>}
          {state === "notConfigured" && <span className="text-warn">{d.notConfigured}</span>}
          {error && <span className="text-bad">{error}</span>}
        </p>
      </div>

      <details className="mt-5 text-xs text-ink2">
        <summary className="cursor-pointer font-medium text-ink">{d.whereTitle}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {d.where.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
