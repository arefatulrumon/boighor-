import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * UI যন্ত্রাংশ — সব পেজ এখান থেকে ব্যবহার করে।
 *
 * ⚠️ নতুন UI বানানোর আগে এখানে দেখুন। ইতিমধ্যে যা আছে তা দিয়ে কাজ চালানো
 *    গেলে নতুন কিছু বানাবেন না — নাহলে দুই জায়গায় দুই রকম বাটন/কার্ড তৈরি হয়।
 *
 * সব নাম আগের মতোই আছে (অ্যাডমিন প্যানেলও এগুলো ব্যবহার করে), তাই
 * এখানে শুধু চেহারা বদলালেও অ্যাডমিন ভাঙবে না।
 */

/** ছোট ক্লাস-মার্জ হেল্পার — কন্ডিশনাল ক্লাস লিখতে সুবিধা। */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------- Container ------------------------------- */

/** সাইটের সব সেকশন একই প্রস্থ আর একই পাশের ফাঁক ব্যবহার করে। */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6", className)}>{children}</div>
  );
}

/* ---------------------------- Section heading ---------------------------- */

/** "সব দেখুন →" লিংকের একরকম চেহারা সব জায়গায় */
export const VIEW_ALL_CLASS =
  "inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-900";

/**
 * সেকশনের শিরোনাম — বাঁয়ে শিরোনাম + ছোট বর্ণনা, ডানে ঐচ্ছিক লিংক।
 *
 * ⚠️ বাংলা লেখায় `tracking-*` দেওয়া হয়নি — ইচ্ছাকৃত (globals.css দেখুন)।
 */
export function SectionHeading({
  title,
  subtitle,
  action,
  eyebrow,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold text-accent-600">{eyebrow}</p>
        )}
        <h2 className="font-display text-2xl text-stone-900 sm:text-[1.75rem]">{title}</h2>
        {subtitle && (
          <p className="prose-bn mt-1.5 text-sm text-stone-600">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* --------------------------------- Button -------------------------------- */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-800 text-white shadow-soft hover:bg-brand-900 active:translate-y-px",
  secondary: "bg-stone-900 text-white hover:bg-black",
  outline:
    "border border-stone-300 bg-white text-stone-800 hover:border-brand-700 hover:bg-brand-50/60 hover:text-brand-900",
  ghost: "text-stone-700 hover:bg-stone-100 hover:text-stone-900",
  danger: "bg-rose-700 text-white hover:bg-rose-800",
  /** অফার/প্রোমোর ডাক — শুধু "সুযোগ" বোঝাতে, বিপদে নয় */
  accent: "bg-accent-600 text-white shadow-soft hover:bg-accent-800",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      {...props}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    />
  );
}

/* ---------------------------------- Card --------------------------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-stone-200/80 bg-white shadow-soft",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
      <h2 className="font-display text-[1.0625rem] text-stone-900">{title}</h2>
      {action}
    </div>
  );
}

/* ---------------------------------- Badge -------------------------------- */

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Form fields ------------------------------ */

export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-800">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export const INPUT_CLASS =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(INPUT_CLASS, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(INPUT_CLASS, "min-h-24", className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cn(INPUT_CLASS, "appearance-none", className)}>
      {children}
    </select>
  );
}

/* ---------------------------------- Alert -------------------------------- */

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-brand-200 bg-brand-50 text-brand-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
  } as const;

  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>
  );
}

/* ---------------------------------- Empty -------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon = "📚",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-14 text-center">
      <p className="text-3xl" aria-hidden>
        {icon}
      </p>
      <p className="font-display mt-3 text-base text-stone-800">{title}</p>
      {description && (
        <p className="prose-bn mx-auto mt-1 max-w-md text-sm text-stone-600">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
