"use client";

import { useState, useTransition } from "react";
import {
  saveAdminNote,
  updateOrderStatus,
  updatePayment,
} from "@/lib/actions/admin";
import {
  COURIERS,
  ORDER_FLOW,
  ORDER_STATUS_LABEL_BN,
  PAYMENT_STATUS_LABEL_BN,
} from "@/lib/constants";
import type { Order, PaymentStatus } from "@/types/database";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

function Feedback({ tone, message }: { tone: "success" | "error"; message: string }) {
  return (
    <div className="mt-3">
      <Alert tone={tone}>{message}</Alert>
    </div>
  );
}

/* ==========================================================================
 *  অর্ডার স্টেটাস বদল
 * ========================================================================== */
export function OrderStatusForm({ order }: { order: Pick<Order, "id" | "status" | "courier" | "tracking_code"> }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  // পরের স্বাভাবিক ধাপ আগেই বাছাই করা থাকে (কম ক্লিক)
  const currentIndex = ORDER_FLOW.indexOf(order.status);
  const suggested = currentIndex >= 0 && currentIndex < ORDER_FLOW.length - 1
    ? ORDER_FLOW[currentIndex + 1]
    : order.status;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateOrderStatus(formData);
      setFeedback(
        result.ok
          ? { tone: "success", message: "স্টেটাস আপডেট হয়েছে।" }
          : { tone: "error", message: "আপডেট করা যায়নি — অনুমতি বা সংযোগ সমস্যা।" }
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-5 py-4">
      <input type="hidden" name="order_id" value={order.id} />

      <Field label="নতুন স্টেটাস" required>
        <Select name="status" defaultValue={suggested}>
          {[...ORDER_FLOW, "cancelled", "returned"].map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL_BN[s as keyof typeof ORDER_STATUS_LABEL_BN]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="কুরিয়ার" hint="শিপ করার সময় দিন">
          <Select name="courier" defaultValue={order.courier ?? ""}>
            <option value="">— বাছুন —</option>
            {COURIERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>

        <Field label="ট্র্যাকিং কোড">
          <Input name="tracking_code" defaultValue={order.tracking_code ?? ""} placeholder="যেমন: PT-12345678" />
        </Field>
      </div>

      <Field label="নোট (ঐচ্ছিক)" hint="অর্ডারের ইতিহাসে সেভ হবে">
        <Input name="note" placeholder="যেমন: কাস্টমার ফোন ধরেননি" />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "আপডেট হচ্ছে..." : "স্টেটাস আপডেট করুন"}
      </Button>

      {feedback && <Feedback tone={feedback.tone} message={feedback.message} />}

      <p className="text-xs text-stone-500">
        ℹ️ বাতিল বা ফেরত দিলে স্টক স্বয়ংক্রিয়ভাবে ফেরত যোগ হবে (একবারই)।
      </p>
    </form>
  );
}

/* ==========================================================================
 *  পেমেন্ট ভেরিফিকেশন
 * ========================================================================== */
export function PaymentForm({
  order,
}: {
  order: Pick<Order, "id" | "payment_status" | "payment_ref" | "payment_amount_received" | "total">;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updatePayment(formData);
      setFeedback(
        result.ok
          ? { tone: "success", message: "পেমেন্ট তথ্য সেভ হয়েছে।" }
          : { tone: "error", message: "সেভ করা যায়নি।" }
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-5 py-4">
      <input type="hidden" name="order_id" value={order.id} />

      <Field label="পেমেন্ট স্টেটাস" required>
        <Select name="payment_status" defaultValue={order.payment_status}>
          {(Object.keys(PAYMENT_STATUS_LABEL_BN) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABEL_BN[s]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="TrxID">
        <Input name="payment_ref" defaultValue={order.payment_ref ?? ""} placeholder="bKash/Nagad Transaction ID" />
      </Field>

      <Field label="প্রাপ্ত টাকার পরিমাণ" hint={`অর্ডারের মোট: ${order.total}`}>
        <Input
          name="payment_amount_received"
          type="number"
          step="0.01"
          defaultValue={order.payment_amount_received ?? ""}
          placeholder={String(order.total)}
        />
      </Field>

      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "সেভ হচ্ছে..." : "পেমেন্ট সেভ করুন"}
      </Button>

      {feedback && <Feedback tone={feedback.tone} message={feedback.message} />}
    </form>
  );
}

/* ==========================================================================
 *  অ্যাডমিন নোট
 * ========================================================================== */
export function AdminNoteForm({ order }: { order: Pick<Order, "id" | "admin_note"> }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSaved(false);
    startTransition(async () => {
      const result = await saveAdminNote(formData);
      setSaved(result.ok);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-5 py-4">
      <input type="hidden" name="order_id" value={order.id} />
      <Field label="অভ্যন্তরীণ নোট" hint="কাস্টমার এটি দেখতে পাবে না">
        <Textarea
          name="admin_note"
          defaultValue={order.admin_note ?? ""}
          placeholder="এখানে দোকানের ভেতরের নোট লিখুন..."
          className="min-h-20"
        />
      </Field>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "সেভ হচ্ছে..." : saved ? "✓ সেভ হয়েছে" : "নোট সেভ করুন"}
      </Button>
    </form>
  );
}
