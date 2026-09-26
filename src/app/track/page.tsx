"use client";

import { useState, useTransition } from "react";
import { trackOrder } from "@/lib/actions/orders";
import {
  ORDER_STATUS_LABEL_BN,
  ORDER_STATUS_COLOR,
  PAYMENT_METHOD_LABEL_BN,
  PAYMENT_STATUS_LABEL_BN,
} from "@/lib/constants";
import { formatDateTimeBn, formatTaka, toBanglaDigits } from "@/lib/format";
import type { TrackOrderResult } from "@/types/database";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Container,
  Field,
  Input,
  cn,
} from "@/components/ui";

/**
 * অর্ডার ট্র্যাকিং — অর্ডার নম্বর + মোবাইল নম্বর দুটোই লাগে।
 *
 * নিরাপত্তা: এখানে সরাসরি `orders` টেবিল পড়া হয় না (RLS তে anon এর
 * SELECT নেই)। `track_order()` RPC কল হয়, যেটা ফোন নম্বর মিলিয়ে দেখে।
 * তাই শুধু অর্ডার নম্বর জানা থাকলে কারো তথ্য দেখা যাবে না।
 */
export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<TrackOrderResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await trackOrder(orderNumber, phone);
      setResult(r);
    });
  }

  return (
    <Container className="max-w-2xl py-10 sm:py-14">
      <h1 className="font-display text-3xl text-stone-900">অর্ডার ট্র্যাক করুন</h1>
      <p className="prose-bn mt-2.5 text-sm text-stone-600">
        অর্ডার নম্বর আর যে মোবাইল নম্বর দিয়ে অর্ডার করেছিলেন সেটা দিন।
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-7 space-y-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-soft"
      >
        <Field label="অর্ডার নম্বর" required>
          <Input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="BK260924-0001"
          />
        </Field>

        <Field label="মোবাইল নম্বর" required>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01712345678"
            inputMode="tel"
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={pending || !orderNumber || !phone}
          className="w-full"
        >
          {pending ? "খোঁজা হচ্ছে..." : "ট্র্যাক করুন"}
        </Button>
      </form>

      {result && !result.ok && (
        <div className="mt-6">
          <Alert tone="error">
            {result.message ?? "এই তথ্য দিয়ে কোনো অর্ডার পাওয়া যায়নি।"}
          </Alert>
        </div>
      )}

      {result && result.ok && (
        <div className="mt-6 space-y-5">
          <Card>
            <CardHeader
              title={`অর্ডার ${result.order_number}`}
              action={
                <Badge className={cn(ORDER_STATUS_COLOR[result.status])}>
                  {ORDER_STATUS_LABEL_BN[result.status]}
                </Badge>
              }
            />
            <dl className="grid gap-4 px-6 py-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-stone-500">অর্ডারের সময়</dt>
                <dd className="mt-0.5 font-medium text-stone-900">
                  {formatDateTimeBn(result.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">পেমেন্ট</dt>
                <dd className="mt-0.5 font-medium text-stone-900">
                  {PAYMENT_METHOD_LABEL_BN[result.payment_method]} —{" "}
                  {PAYMENT_STATUS_LABEL_BN[result.payment_status]}
                </dd>
              </div>
              {result.shipped_at && (
                <div>
                  <dt className="text-stone-500">কুরিয়ারে দেওয়া হয়েছে</dt>
                  <dd className="mt-0.5 font-medium text-stone-900">
                    {formatDateTimeBn(result.shipped_at)}
                  </dd>
                </div>
              )}
              {result.delivered_at && (
                <div>
                  <dt className="text-stone-500">ডেলিভারি সম্পন্ন</dt>
                  <dd className="mt-0.5 font-medium text-stone-900">
                    {formatDateTimeBn(result.delivered_at)}
                  </dd>
                </div>
              )}
              {result.courier && (
                <div>
                  <dt className="text-stone-500">কুরিয়ার</dt>
                  <dd className="mt-0.5 font-medium text-stone-900">
                    {result.courier}
                    {result.tracking_code && ` — ${result.tracking_code}`}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title={`বই (${toBanglaDigits(result.items.length)}টি)`} />
            <ul className="divide-y divide-stone-100">
              {result.items.map((item, i) => (
                <li
                  key={`${item.title}-${i}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-stone-900">{item.title}</span>
                    <span className="tabular mt-1 block text-xs text-stone-500">
                      {formatTaka(item.unit_price, { symbol: true })} ×{" "}
                      {toBanglaDigits(item.quantity)}
                    </span>
                  </span>
                  <span className="tabular shrink-0 font-semibold text-stone-900">
                    {formatTaka(item.line_total, { symbol: true })}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between border-t border-stone-100 px-6 py-5">
              <span className="font-display text-stone-900">সর্বমোট</span>
              <span className="font-display tabular text-xl text-brand-900">
                {formatTaka(result.total, { symbol: true })}
              </span>
            </div>
          </Card>
        </div>
      )}
    </Container>
  );
}
