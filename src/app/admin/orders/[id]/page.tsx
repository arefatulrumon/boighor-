import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminNoteForm,
  OrderStatusForm,
  PaymentForm,
} from "@/components/admin/order-forms";
import { CourierCard } from "@/components/admin/courier-card";
import { PrintButton } from "@/components/print-button";
import { listCourierProviders } from "@/lib/courier";
import { Badge, Card, CardHeader, cn } from "@/components/ui";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL_BN,
  PAYMENT_METHOD_LABEL_BN,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL_BN,
} from "@/lib/constants";
import { formatDateTimeBn, formatTaka, toBanglaDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatusHistory, OrderWithItems } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function AdminOrderDetail({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: orderData, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();

  if (error || !orderData) notFound();

  const order = orderData as unknown as OrderWithItems;

  const { data: historyData } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const history = (historyData ?? []) as OrderStatusHistory[];

  // কোন কুরিয়ারের API কী বসানো আছে — সেটা UI তে জানানো দরকার।
  // (ফাংশন পাঠানো যায় না, তাই শুধু সাধারণ ডেটা পাঠানো হয়।)
  const providers = listCourierProviders().map((p) => ({
    id: p.id,
    name: p.name,
    configured: p.isConfigured(),
  }));

  return (
    <div className="space-y-5">
      {/* ------------------------------- হেডার ------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm text-stone-500 hover:text-emerald-800">
            ← সব অর্ডার
          </Link>
          <h1 className="tabular mt-1 text-2xl font-bold text-stone-900">
            {order.order_number}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {formatDateTimeBn(order.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn(ORDER_STATUS_COLOR[order.status])}>
            {ORDER_STATUS_LABEL_BN[order.status]}
          </Badge>
          <Badge className={cn(PAYMENT_STATUS_COLOR[order.payment_status])}>
            {PAYMENT_STATUS_LABEL_BN[order.payment_status]}
          </Badge>
          <PrintButton label="ইনভয়েস" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* ============================ বাঁ দিক ============================ */}
        <div className="space-y-5">
          {/* কাস্টমার */}
          <Card>
            <CardHeader title="কাস্টমার ও ঠিকানা" />
            <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-stone-500">নাম</dt>
                <dd className="mt-0.5 font-medium text-stone-900">{order.customer_name}</dd>
              </div>
              <div>
                <dt className="text-stone-500">মোবাইল</dt>
                <dd className="tabular mt-0.5 font-medium text-stone-900">
                  <a href={`tel:${order.customer_phone}`} className="text-emerald-800 hover:underline">
                    {order.customer_phone}
                  </a>
                </dd>
              </div>
              {order.customer_email && (
                <div className="sm:col-span-2">
                  <dt className="text-stone-500">ইমেইল</dt>
                  <dd className="mt-0.5 text-stone-900">{order.customer_email}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-stone-500">পূর্ণ ঠিকানা</dt>
                <dd className="prose-bn mt-0.5 whitespace-pre-line text-stone-900">
                  {order.address_line}
                  {"\n"}
                  {order.area && `${order.area}, `}
                  {order.district}, {order.division}
                  {order.postcode && ` - ${order.postcode}`}
                </dd>
              </div>
              {order.delivery_note && (
                <div className="sm:col-span-2">
                  <dt className="text-stone-500">ডেলিভারি নোট</dt>
                  <dd className="prose-bn mt-0.5 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    {order.delivery_note}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* আইটেম */}
          <Card>
            <CardHeader title={`বই (${toBanglaDigits(order.order_items.length)}টি)`} />
            <ul className="divide-y divide-stone-100">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                    {item.cover_snapshot ? (
                      <Image src={item.cover_snapshot} alt={item.title_snapshot} fill sizes="56px" className="object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-xl">📗</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-stone-900">
                      {item.title_snapshot}
                    </p>
                    {item.author_snapshot && (
                      <p className="text-xs text-stone-500">{item.author_snapshot}</p>
                    )}
                    <p className="tabular mt-0.5 text-xs text-stone-500">
                      {formatTaka(item.unit_price, { symbol: true })} × {toBanglaDigits(item.quantity)}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-sm font-semibold text-stone-900">
                    {formatTaka(item.line_total, { symbol: true })}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-stone-200 px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-600">সাবটোটাল</dt>
                <dd className="tabular">{formatTaka(order.subtotal, { symbol: true })}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>ছাড় {order.coupon_code && `(${order.coupon_code})`}</dt>
                  <dd className="tabular">− {formatTaka(order.discount, { symbol: true })}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-stone-600">ডেলিভারি চার্জ</dt>
                <dd className="tabular">{formatTaka(order.delivery_fee, { symbol: true })}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-stone-200 pt-2.5">
                <dt className="font-semibold text-stone-900">সর্বমোট</dt>
                <dd className="tabular text-lg font-bold text-emerald-900">
                  {formatTaka(order.total, { symbol: true })}
                </dd>
              </div>
            </dl>
          </Card>

          {/* ইতিহাস */}
          <Card>
            <CardHeader title="অর্ডারের ইতিহাস" />
            {history.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-stone-500">কোনো ইতিহাস নেই।</p>
            ) : (
              <ol className="divide-y divide-stone-100">
                {history.map((h) => (
                  <li key={h.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-stone-900">
                        {h.from_status
                          ? `${ORDER_STATUS_LABEL_BN[h.from_status]} → ${ORDER_STATUS_LABEL_BN[h.to_status]}`
                          : ORDER_STATUS_LABEL_BN[h.to_status]}
                      </span>
                      <span className="text-xs text-stone-400">
                        {formatDateTimeBn(h.created_at)}
                      </span>
                    </div>
                    {h.note && (
                      <p className="prose-bn mt-1 text-xs text-stone-600">{h.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* ============================ ডান দিক ============================ */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="কুরিয়ার" />
            <CourierCard order={order} providers={providers} />
          </Card>

          <Card>
            <CardHeader title="স্টেটাস আপডেট" />
            <OrderStatusForm order={order} />
          </Card>

          <Card>
            <CardHeader title="পেমেন্ট" />
            <div className="px-5 pt-4 text-sm">
              <p className="text-stone-600">
                মাধ্যম: <strong className="text-stone-900">{PAYMENT_METHOD_LABEL_BN[order.payment_method]}</strong>
              </p>
              {order.payment_sender_phone && (
                <p className="tabular mt-1 text-stone-600">
                  প্রেরকের নম্বর: <strong className="text-stone-900">{order.payment_sender_phone}</strong>
                </p>
              )}
            </div>
            <PaymentForm order={order} />
          </Card>

          <Card>
            <CardHeader title="অভ্যন্তরীণ নোট" />
            <AdminNoteForm order={order} />
          </Card>
        </div>
      </div>
    </div>
  );
}
