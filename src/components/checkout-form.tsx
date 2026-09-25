"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { checkCoupon, placeOrder } from "@/lib/actions/orders";
import {
  DISTRICTS_BY_DIVISION,
  DIVISIONS,
  MAX_CART_LINES,
  type Division,
} from "@/lib/constants";
import { formatTaka, toBanglaDigits } from "@/lib/format";
import {
  EMPTY_CHECKOUT,
  validateCheckout,
  type CheckoutForm,
  type FieldErrors,
} from "@/lib/validation";
import type { DeliveryZone } from "@/types/database";
import { Alert, Button, Field, Input, Select, Textarea, cn } from "./ui";

interface Props {
  zones: DeliveryZone[];
  settings: {
    bkash_number: string;
    nagad_number: string;
    payment_instruction: string;
    delivery_default_fee: number;
  };
}

export function CheckoutForm({ zones, settings }: Props) {
  const router = useRouter();
  const { lines, subtotal, ready, clear } = useCart();

  const [form, setForm] = useState<CheckoutForm>(EMPTY_CHECKOUT);
  const [errors, setErrors] = useState<FieldErrors<keyof CheckoutForm>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(null);
  };

  // ---- ডেলিভারি চার্জ প্রিভিউ (আসল হিসাব ডেটাবেসে হয়) ----
  const zone = useMemo(
    () => zones.find((z) => z.division === form.division) ?? null,
    [zones, form.division]
  );

  const deliveryFee = useMemo(() => {
    if (!zone) return settings.delivery_default_fee;
    if (zone.free_above !== null && subtotal >= zone.free_above) return 0;
    return zone.fee;
  }, [zone, subtotal, settings.delivery_default_fee]);

  const discount = coupon?.discount ?? 0;
  const total = Math.max(subtotal - discount, 0) + deliveryFee;

  const districts = form.division
    ? DISTRICTS_BY_DIVISION[form.division as Division] ?? []
    : [];

  /* --------------------------- কুপন যাচাই --------------------------- */
  async function applyCoupon() {
    const code = form.coupon_code.trim();
    if (!code) {
      setCoupon(null);
      setCouponMsg(null);
      return;
    }

    const result = await checkCoupon(code, subtotal);

    if (!result.valid) {
      setCoupon(null);
      const messages: Record<string, string> = {
        NOT_FOUND: "এই কুপন কোডটি পাওয়া যায়নি।",
        EXPIRED: "কুপনের মেয়াদ শেষ হয়ে গেছে।",
        INACTIVE: "কুপনটি এখন চালু নেই।",
        NOT_STARTED: "কুপনটি এখনো শুরু হয়নি।",
        USAGE_LIMIT: "কুপনের ব্যবহারের সীমা শেষ।",
        MIN_ORDER: `কমপক্ষে ${formatTaka(result.min_order ?? 0)} কেনাকাটা করতে হবে।`,
        EMPTY: "কুপন কোড লিখুন।",
      };
      setCouponMsg(messages[result.reason] ?? "কুপনটি ব্যবহার করা যাচ্ছে না।");
      return;
    }

    setCoupon({ code: result.code, discount: result.discount });
    setCouponMsg(
      `কুপন প্রয়োগ হয়েছে — ${formatTaka(result.discount, { symbol: true })} ছাড়`
    );
  }

  /* --------------------------- অর্ডার সাবমিট --------------------------- */
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const found = validateCheckout(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setServerError("কিছু তথ্য ঠিক নেই — লাল লেখা দেখে সংশোধন করুন।");
      return;
    }

    if (lines.length === 0) {
      setServerError("আপনার কার্ট খালি।");
      return;
    }

    startTransition(async () => {
      const result = await placeOrder({
        ...form,
        coupon_code: coupon?.code ?? form.coupon_code,
        items: lines.map((l) => ({ book_id: l.book_id, quantity: l.quantity })),
      });

      if (!result.ok) {
        setServerError(result.message);
        // স্টক সমস্যা হলে কার্ট রিফ্রেশ করতে বলি
        if (result.code === "OUT_OF_STOCK" || result.code === "BOOK_INACTIVE") {
          setServerError(
            `${result.message} — কার্ট আপডেট করে আবার চেষ্টা করুন।`
          );
        }
        return;
      }

      clear();
      router.push(`/order/${result.order_number}`);
    });
  }

  if (!ready) {
    return <p className="py-10 text-center text-sm text-stone-500">লোড হচ্ছে...</p>;
  }

  if (lines.length === 0) {
    return (
      <Alert tone="warning">
        আপনার কার্ট খালি। <a href="/books" className="font-medium underline">বই দেখুন</a>।
      </Alert>
    );
  }

  const needsTrx = form.payment_method !== "cod";

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]" noValidate>
      {/* ============================= বাঁ দিক ============================= */}
      <div className="space-y-6">
        {/* --------------------------- কাস্টমার তথ্য --------------------------- */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-stone-900">
            ১. আপনার তথ্য
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="পুরো নাম" required error={errors.customer_name}>
              <Input
                value={form.customer_name}
                onChange={(e) => set("customer_name", e.target.value)}
                placeholder="আপনার নাম"
                autoComplete="name"
              />
            </Field>

            <Field
              label="মোবাইল নম্বর"
              required
              error={errors.customer_phone}
              hint="এই নম্বরেই কুরিয়ার কল দেবে"
            >
              <Input
                value={form.customer_phone}
                onChange={(e) => set("customer_phone", e.target.value)}
                placeholder="01712345678"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="ইমেইল (ইচ্ছা হলে)" error={errors.customer_email}>
                <Input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => set("customer_email", e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>
            </div>
          </div>
        </section>

        {/* ----------------------------- ঠিকানা ----------------------------- */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-stone-900">
            ২. ডেলিভারি ঠিকানা
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="বিভাগ" required error={errors.division}>
              <Select
                value={form.division}
                onChange={(e) => {
                  set("division", e.target.value);
                  set("district", ""); // বিভাগ বদলালে জেলা রিসেট
                }}
              >
                <option value="">— বিভাগ বাছুন —</option>
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </Field>

            <Field label="জেলা" required error={errors.district}>
              <Select
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
                disabled={!form.division}
              >
                <option value="">
                  {form.division ? "— জেলা বাছুন —" : "আগে বিভাগ বাছুন"}
                </option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </Field>

            <Field label="এলাকা / থানা (ইচ্ছা হলে)" error={errors.area}>
              <Input
                value={form.area}
                onChange={(e) => set("area", e.target.value)}
                placeholder="যেমন: মিরপুর ১০"
              />
            </Field>

            <Field label="পোস্ট কোড (ইচ্ছা হলে)" error={errors.postcode}>
              <Input
                value={form.postcode}
                onChange={(e) => set("postcode", e.target.value)}
                placeholder="1216"
                inputMode="numeric"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field
                label="সম্পূর্ণ ঠিকানা"
                required
                error={errors.address_line}
                hint="বাসা/ফ্ল্যাট, রোড, এলাকা — কুরিয়ার যেন সহজে খুঁজে পায়"
              >
                <Textarea
                  value={form.address_line}
                  onChange={(e) => set("address_line", e.target.value)}
                  placeholder="বাসা ১২, রোড ৫, ব্লক সি, মিরপুর"
                  autoComplete="street-address"
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="ডেলিভারি নোট (ইচ্ছা হলে)" error={errors.delivery_note}>
                <Input
                  value={form.delivery_note}
                  onChange={(e) => set("delivery_note", e.target.value)}
                  placeholder="যেমন: সকাল ১০টার পরে কল করুন"
                />
              </Field>
            </div>
          </div>

          {zone && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {zone.name_bn}: ডেলিভারি চার্জ {formatTaka(zone.fee, { symbol: true })} ·{" "}
              {toBanglaDigits(zone.eta_days_min)}–{toBanglaDigits(zone.eta_days_max)} দিনে পৌঁছাবে
              {zone.free_above !== null &&
                ` · ${formatTaka(zone.free_above, { symbol: true })} এর উপরে ফ্রি`}
            </p>
          )}
        </section>

        {/* ----------------------------- পেমেন্ট ----------------------------- */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-stone-900">৩. পেমেন্ট</h2>

          <div className="space-y-3">
            {[
              {
                value: "cod",
                title: "ক্যাশ অন ডেলিভারি",
                desc: "বই হাতে পেয়ে কুরিয়ারকে টাকা দিন। এখন কিছু লাগবে না।",
              },
              {
                value: "bkash",
                title: "bKash (অগ্রিম)",
                desc: settings.bkash_number
                  ? `Send Money করুন: ${settings.bkash_number}`
                  : "bKash নম্বর সেট করা হয়নি — অ্যাডমিন সেটিংস দেখুন।",
              },
              {
                value: "nagad",
                title: "Nagad (অগ্রিম)",
                desc: settings.nagad_number
                  ? `Send Money করুন: ${settings.nagad_number}`
                  : "Nagad নম্বর সেট করা হয়নি — অ্যাডমিন সেটিংস দেখুন।",
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-colors",
                  form.payment_method === opt.value
                    ? "border-emerald-700 bg-emerald-50"
                    : "border-stone-300 hover:bg-stone-50"
                )}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={opt.value}
                  checked={form.payment_method === opt.value}
                  onChange={() => set("payment_method", opt.value)}
                  className="mt-1 size-4 accent-emerald-800"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-stone-900">{opt.title}</span>
                  <span className="mt-0.5 block text-xs text-stone-600">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>

          {needsTrx && (
            <div className="mt-5 space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-900">
                {settings.payment_instruction ||
                  "Send Money করার পর Transaction ID নিচে লিখুন।"}
              </p>

              <Field label="Transaction ID (TrxID)" required error={errors.payment_ref}>
                <Input
                  value={form.payment_ref}
                  onChange={(e) => set("payment_ref", e.target.value)}
                  placeholder="যেমন: 9F2K1L7M3Q"
                />
              </Field>

              <Field
                label="যে নম্বর থেকে পাঠিয়েছেন (ইচ্ছা হলে)"
                error={errors.payment_sender_phone}
              >
                <Input
                  value={form.payment_sender_phone}
                  onChange={(e) => set("payment_sender_phone", e.target.value)}
                  placeholder="01712345678"
                  inputMode="tel"
                />
              </Field>
            </div>
          )}
        </section>
      </div>

      {/* ============================= ডান দিক ============================= */}
      <aside className="h-fit space-y-4 lg:sticky lg:top-24">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">আপনার অর্ডার</h2>

          <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
            {lines.map((l) => (
              <li key={l.book_id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-stone-800">{l.title}</span>
                  <span className="tabular text-xs text-stone-500">
                    {formatTaka(l.price, { symbol: true })} × {toBanglaDigits(l.quantity)}
                  </span>
                </span>
                <span className="tabular shrink-0 font-medium">
                  {formatTaka(l.price * l.quantity, { symbol: true })}
                </span>
              </li>
            ))}
          </ul>

          {/* কুপন */}
          <div className="mt-5 border-t border-stone-200 pt-4">
            <Field label="কুপন কোড (ইচ্ছা হলে)">
              <div className="flex gap-2">
                <Input
                  value={form.coupon_code}
                  onChange={(e) => set("coupon_code", e.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                />
                <Button type="button" variant="outline" onClick={applyCoupon} className="shrink-0">
                  প্রয়োগ
                </Button>
              </div>
            </Field>
            {couponMsg && (
              <p
                className={cn(
                  "mt-2 text-xs",
                  coupon ? "text-emerald-700" : "text-rose-600"
                )}
              >
                {couponMsg}
              </p>
            )}
          </div>

          {/* হিসাব */}
          <dl className="mt-5 space-y-2.5 border-t border-stone-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">সাবটোটাল</dt>
              <dd className="tabular font-medium">{formatTaka(subtotal, { symbol: true })}</dd>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>ছাড় {coupon?.code && `(${coupon.code})`}</dt>
                <dd className="tabular font-medium">
                  − {formatTaka(discount, { symbol: true })}
                </dd>
              </div>
            )}

            <div className="flex justify-between">
              <dt className="text-stone-600">ডেলিভারি চার্জ</dt>
              <dd className="tabular font-medium">
                {deliveryFee === 0 ? "ফ্রি" : formatTaka(deliveryFee, { symbol: true })}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-stone-200 pt-4">
            <span className="font-semibold text-stone-900">সর্বমোট</span>
            <span className="tabular text-xl font-bold text-emerald-900">
              {formatTaka(total, { symbol: true })}
            </span>
          </div>

          {serverError && (
            <div className="mt-4">
              <Alert tone="error">{serverError}</Alert>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={pending || lines.length >= MAX_CART_LINES + 1}
            className="mt-5 w-full"
          >
            {pending ? "অর্ডার হচ্ছে..." : "অর্ডার নিশ্চিত করুন"}
          </Button>

          <p className="mt-3 text-center text-xs text-stone-500">
            অর্ডার করলে আপনি আমাদের শর্তাবলী মেনে নিচ্ছেন।
          </p>
        </div>
      </aside>
    </form>
  );
}
