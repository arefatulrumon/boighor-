"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bookCourierOrder,
  syncOrderCourierStatus,
  type CourierActionResult,
} from "@/lib/actions/courier";
import { formatDateTimeBn } from "@/lib/format";
import type { Order } from "@/types/database";
import { Alert, Badge, Button, Field, Select } from "@/components/ui";

export interface ProviderOption {
  id: string;
  name: string;
  configured: boolean;
}

/**
 * কুরিয়ার কার্ড — অর্ডার ডিটেইল পেজে বসে।
 *
 * দুটি কাজ:
 *   ১) কুরিয়ারে বুক করা (স্টিল সাপোর্ট করে SteadFast)
 *   ২) কুরিয়ার থেকে স্টেটাস টেনে আনা
 *
 * ⚠️ কোনো API কী সেট না থাকলে বুকিং বাটন নিষ্ক্রিয় থাকে, কিন্তু
 *    ট্র্যাকিং কোড হাতে লেখার পথ খোলা থাকে — অর্থাৎ কুরিয়ার ইন্টিগ্রেশন
 *    ছাড়াও দোকান পুরোপুরি চালানো যায়।
 */
export function CourierCard({
  order,
  providers,
}: {
  order: Pick<
    Order,
    | "id"
    | "order_number"
    | "status"
    | "courier"
    | "tracking_code"
    | "courier_consignment_id"
    | "courier_synced_at"
  >;
  providers: ProviderOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<CourierActionResult | null>(null);
  const [providerId, setProviderId] = useState(
    providers.find((p) => p.configured)?.id ?? providers[0]?.id ?? ""
  );

  const configured = providers.filter((p) => p.configured);
  const alreadyBooked = Boolean(order.tracking_code);
  const finished = ["delivered", "cancelled", "returned"].includes(order.status);

  function run(action: (fd: FormData) => Promise<CourierActionResult>, extra?: Record<string, string>) {
    const formData = new FormData();
    formData.set("order_id", order.id);
    Object.entries(extra ?? {}).forEach(([k, v]) => formData.set(k, v));

    setFeedback(null);
    startTransition(async () => {
      const result = await action(formData);
      setFeedback(result);
      router.refresh();
    });
  }

  return (
    <div className="px-5 py-4">
      {/* ------------------------------ বর্তমান অবস্থা ------------------------------ */}
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-stone-500">কুরিয়ার</dt>
          <dd className="font-medium text-stone-900">{order.courier ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-stone-500">ট্র্যাকিং কোড</dt>
          <dd className="tabular font-medium text-stone-900">
            {order.tracking_code ?? (
              <span className="text-xs font-normal text-stone-400">বুক করা হয়নি</span>
            )}
          </dd>
        </div>
        {order.courier_consignment_id && (
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Consignment ID</dt>
            <dd className="tabular font-medium text-stone-900">
              {order.courier_consignment_id}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-stone-500">শেষ সিঙ্ক</dt>
          <dd className="text-stone-700">
            {order.courier_synced_at ? formatDateTimeBn(order.courier_synced_at) : "—"}
          </dd>
        </div>
      </dl>

      {order.tracking_code && order.courier && (
        <div className="mt-3">
          <Badge className="border-sky-200 bg-sky-50 text-sky-800">
            {order.courier} · {order.tracking_code}
          </Badge>
        </div>
      )}

      {/* -------------------------------- কী কী করা যায় -------------------------------- */}

      {!alreadyBooked && !finished && (
        <div className="mt-5 space-y-3 border-t border-stone-200 pt-4">
          {configured.length === 0 ? (
            <Alert tone="warning">
              কোনো কুরিয়ারের API কী সেট করা নেই। নিচে &quot;ট্র্যাকিং কোড হাতে লিখুন&quot;
              দিয়ে অর্ডার পাঠিয়ে, উপরে স্টেটাস আপডেট করুন — এভাবে কুরিয়ার
              ইন্টিগ্রেশন ছাড়াও দোকান চালানো যায়।
            </Alert>
          ) : (
            <>
              {configured.length > 1 && (
                <Field label="কুরিয়ার">
                  <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                    {configured.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Button
                type="button"
                disabled={pending}
                onClick={() => run(bookCourierOrder, { provider: providerId })}
                className="w-full"
              >
                {pending ? "বুক হচ্ছে..." : "🚚 কুরিয়ারে বুক করুন"}
              </Button>

              <p className="text-xs text-stone-500">
                বুক হলে ট্র্যাকিং কোড স্বয়ংক্রিয়ভাবে সেভ হবে এবং অর্ডারের
                স্টেটাস &quot;পাঠানো হয়েছে&quot; হবে।
                {order.status === "pending" || order.status === "confirmed"
                  ? " (কাস্টমারকে ফোনে নিশ্চিত করার পর বুক করাই ভালো)"
                  : ""}
              </p>
            </>
          )}
        </div>
      )}

      {alreadyBooked && (
        <div className="mt-5 border-t border-stone-200 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={pending || finished}
            onClick={() => run(syncOrderCourierStatus)}
            className="w-full"
          >
            {pending ? "সিঙ্ক হচ্ছে..." : "🔄 কুরিয়ার থেকে স্টেটাস আনুন"}
          </Button>

          {finished && (
            <p className="mt-2 text-xs text-stone-500">
              অর্ডারটি সম্পন্ন/বাতিল — আর সিঙ্ক করার দরকার নেই।
            </p>
          )}
        </div>
      )}

      {feedback && (
        <div className="mt-3">
          <Alert tone={feedback.ok ? "success" : "error"}>
            {feedback.message ??
              (feedback.ok
                ? `সফল হয়েছে${feedback.trackingCode ? ` — ট্র্যাকিং ${feedback.trackingCode}` : ""}`
                : `ব্যর্থ (${feedback.code})`)}
          </Alert>
        </div>
      )}
    </div>
  );
}
