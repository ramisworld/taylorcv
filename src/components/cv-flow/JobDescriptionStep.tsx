"use client";

import { ArrowRight, FileText, Loader2, Lock, Target } from "lucide-react";
import { motion } from "framer-motion";
import { useRef } from "react";

import { cn } from "~/lib/utils";

export function JobDescriptionStep(props: {
  value: string;
  error?: string | null;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const maxCharacters = 20_000;

  async function pasteFromClipboard() {
    textareaRef.current?.focus();
    try {
      const text = await navigator.clipboard?.readText();
      if (text) props.onChange(text.slice(0, maxCharacters));
    } catch {
      // Clipboard permissions can fail; focus remains in the field for manual paste.
    }
  }

  return (
    <WorkflowPanel eyebrow="Step 1 of 4" title="Paste the role. Taylor will find the hiring signal.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <GlassCard className="p-4 sm:p-5">
          <div className="relative">
            <textarea
              className="h-[340px] w-full resize-none rounded-[16px] border border-[#cad8f2]/70 bg-white/72 px-5 py-5 pr-14 text-[15px] leading-6 text-[#111827] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] placeholder:text-[#66728b] transition focus:border-[#2450f4]/55 focus:bg-white focus:shadow-[0_0_0_4px_rgba(36,80,244,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]"
              maxLength={maxCharacters}
              onChange={(event) => props.onChange(event.target.value)}
              placeholder="Paste the full job description here..."
              ref={textareaRef}
              value={props.value}
            />
            <button
              aria-label="Paste job description"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-[10px] border border-[#d8e0ee] bg-white/80 text-[#2450f4] shadow-sm transition hover:scale-[1.03] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/16"
              onClick={() => void pasteFromClipboard()}
              type="button"
            >
              <FileText className="h-4.5 w-4.5" />
            </button>
            <p className="absolute bottom-4 right-5 text-[12px] font-medium text-[#66728b]">
              {props.value.length.toLocaleString()} / {maxCharacters.toLocaleString()}
            </p>
          </div>
          {props.error ? (
            <p className="mt-3 rounded-[10px] border border-amber-300/45 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {props.error}
            </p>
          ) : null}
          <button
            className="mt-4 inline-flex h-[54px] w-full items-center justify-center gap-3 rounded-[12px] border border-[#4269ff]/30 bg-[linear-gradient(180deg,#3768ff_0%,#2250f4_54%,#1743df_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_16px_34px_rgba(32,71,240,0.28)] transition hover:scale-[1.01] hover:shadow-[0_18px_38px_rgba(32,71,240,0.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/24 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={props.isLoading || !props.value.trim()}
            onClick={props.onSubmit}
            type="button"
          >
            {props.isLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Target className="h-4.5 w-4.5" />}
            Build the job brief
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </GlassCard>
        <aside className="space-y-3">
          {[
            ["Extracts the role signal", "Taylor finds the requirements that actually shape the CV."],
            ["Keeps it practical", "No match-score theatre or evidence-map detours."],
            ["Fast next step", "You move straight to adding your current CV."],
          ].map(([title, copy]) => (
            <GlassCard className="p-4" key={title}>
              <p className="text-[14px] font-semibold text-[#080d22]">{title}</p>
              <p className="mt-1 text-[13px] leading-5 text-[#5f6c84]">{copy}</p>
            </GlassCard>
          ))}
          <p className="flex items-center gap-2 px-1 text-[12.5px] font-medium text-[#66728b]">
            <Lock className="h-3.5 w-3.5" />
            Your job text is used only to tailor this CV.
          </p>
        </aside>
      </div>
    </WorkflowPanel>
  );
}

export function WorkflowPanel(props: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="mb-6 max-w-3xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#2450f4]">
          {props.eyebrow}
        </p>
        <h1 className="mt-3 text-balance text-[34px] font-semibold leading-[1.03] tracking-[-0.04em] text-[#080d22] sm:text-[46px]">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#536078]">
            {props.subtitle}
          </p>
        ) : null}
      </div>
      {props.children}
    </motion.section>
  );
}

export function GlassCard(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[18px] border border-white/70 bg-white/62 shadow-[0_22px_60px_rgba(36,64,118,0.13),0_4px_16px_rgba(20,35,68,0.06),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-2xl",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(115deg,rgba(255,255,255,0.54)_0%,rgba(255,255,255,0.18)_28%,transparent_56%)] before:opacity-70",
        props.className
      )}
    >
      <div className="relative z-10">{props.children}</div>
    </div>
  );
}
