"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adjustStock,
  deleteReview,
  setReviewApproval,
  toggleBookActive,
  updateSetting,
} from "@/lib/actions/admin";
import { toBanglaDigits } from "@/lib/format";
import { Alert, Button, Field, Input } from "@/components/ui";

/* ==========================================================================
 *  স্টক বাড়ানো/কমানো — ইনলাইন ছোট কন্ট্রোল
 * ========================================================================== */
export function StockAdjust({ bookId, stockQty }: { bookId: string; stockQty: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(String(stockQty));
  const [delta, setDelta] = useState("");

  function apply() {
    const value = Number(delta);
    if (!Number.isFinite(value) || value === 0) return;

    const formData = new FormData();
    formData.set("book_id", bookId);
    formData.set("delta", String(value));

    startTransition(async () => {
      const result = await adjustStock(formData);
      if (result.ok) {
        setQty(String((result as { stock_qty?: number }).stock_qty ?? qty));
        setDelta("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="tabular w-10 text-center text-sm font-semibold text-stone-900">
        {toBanglaDigits(qty)}
      </span>
      <input
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        placeholder="±"
        className="w-14 rounded-lg border border-stone-300 px-2 py-1 text-center text-sm focus:border-emerald-700 focus:outline-none"
        inputMode="numeric"
        aria-label="স্টক পরিবর্তন"
      />
      <button
        type="button"
        onClick={apply}
        disabled={pending || !delta}
        className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium hover:bg-stone-50 disabled:opacity-40"
      >
        {pending ? "..." : "যোগ"}
      </button>
    </div>
  );
}

/* ==========================================================================
 *  বই চালু/বন্ধ টগল
 * ========================================================================== */
export function ToggleBookActive({ bookId, isActive }: { bookId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(isActive);

  function toggle() {
    const next = !active;
    const formData = new FormData();
    formData.set("id", bookId);
    formData.set("is_active", String(next));

    startTransition(async () => {
      const result = await toggleBookActive(formData);
      if (result.ok) {
        setActive(next);
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
        (active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border-stone-300 bg-stone-100 text-stone-600 hover:bg-stone-200")
      }
    >
      {pending ? "..." : active ? "সক্রিয়" : "বন্ধ"}
    </button>
  );
}

/* ==========================================================================
 *  রিভিউ অ্যাপ্রুভ / ডিলিট
 * ========================================================================== */
export function ReviewActions({ reviewId, isApproved }: { reviewId: string; isApproved: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approved, setApproved] = useState(isApproved);

  function setApproval(next: boolean) {
    const formData = new FormData();
    formData.set("id", reviewId);
    formData.set("is_approved", String(next));
    startTransition(async () => {
      const result = await setReviewApproval(formData);
      if (result.ok) {
        setApproved(next);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm("এই রিভিউটি মুছে ফেলতে চান?")) return;
    const formData = new FormData();
    formData.set("id", reviewId);
    startTransition(async () => {
      const result = await deleteReview(formData);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={approved ? "outline" : "primary"}
        disabled={pending}
        onClick={() => setApproval(!approved)}
      >
        {approved ? "অ্যাপ্রুভড ✓" : "অ্যাপ্রুভ করুন"}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={remove}>
        মুছুন
      </Button>
    </div>
  );
}

/* ==========================================================================
 *  সাইট সেটিংস — এক ফর্মে সব key
 * ========================================================================== */
export interface SettingRow {
  key: string;
  value: unknown;
  label_bn: string | null;
  is_public: boolean;
}

export function SettingsForm({ settings }: { settings: SettingRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);

    startTransition(async () => {
      let saved = 0;
      for (const [key, raw] of formData.entries()) {
        if (typeof raw !== "string") continue;

        const single = new FormData();
        single.set("key", key);
        single.set("value", raw);

        const result = await updateSetting(single);
        if (result.ok) saved += 1;
      }
      setMessage(`${toBanglaDigits(saved)}টি সেটিং সেভ হয়েছে।`);
      router.refresh();
    });
  }

  function displayValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {settings.map((s) => (
          <Field
            key={s.key}
            label={s.label_bn ?? s.key}
            hint={s.is_public ? s.key : `${s.key} (শুধু অ্যাডমিন)`}
          >
            <Input name={s.key} defaultValue={displayValue(s.value)} />
          </Field>
        ))}
      </div>

      {message && <Alert tone="success">{message}</Alert>}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "সেভ হচ্ছে..." : "সব সেভ করুন"}
      </Button>
    </form>
  );
}
