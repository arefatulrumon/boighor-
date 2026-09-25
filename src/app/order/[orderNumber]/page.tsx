import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { Alert, ButtonLink, Card, CardHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_STATUS_LABEL_BN,
  PAYMENT_METHOD_LABEL_BN,
  PAYMENT_STATUS_LABEL_BN,
} from "@/lib/constants";
import { formatDateTimeBn, formatTaka, toBanglaDigits } from "@/lib/format";
import { getPublicSettings } from "@/lib/settings";
import type { TrackOrderResult } from "@/types/database";

export const metadata: Metadata = {
  title: "অর্ডার নিশ্চিত হয়েছে",
  robots: { index: false, follow: false },
};

type Params = Promise<{ orderNumber: string }>;

/**
 * অর্ডার কনফার্মেশন পেজ।
 *
 * অর্ডার তৈরি হওয়ার সময় `placeOrder` দুটি httpOnly কুকি সেট করে
 * (অর্ডার নম্বর + ফোন)। এখানে সেটা পড়ে track_order() দিয়ে তথ্য আনা হয়।
 *
 * কেন কুকি? URL এ ফোন নম্বর রাখলে সেটা ব্রাউজার হিস্টরি, সার্ভার লগ ও
 * রেফারার হেডারে ছড়িয়ে পড়ে। কুকি httpOnly হওয়ায় JavaScript-ও পড়তে পারে না —
 * অনেক বেশি নিরাপদ।
 */
export default async function OrderConfirmationPage({ params }: { params: Params }) {
  const { orderNumber } = await params;
  const cookieStore = await cookies();

  const savedNumber = cookieStore.get("boighor_last_order")?.value;
  const savedPhone = cookieStore.get("boighor_last_phone")?.value;

  const settings = await getPublicSettings();

  // কুকি না মিললে (যেমন লিংক শেয়ার করে কেউ খুললে) অর্ডার দেখানো হয় না।
  if (!savedNumber || !savedPhone || savedNumber.toUpperCase() !== orderNumber.toUpperCase()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="warning">
          এই অর্ডারের তথ্য দেখাতে অর্ডার নম্বর ও মোবাইল নম্বর দুটোই লাগবে।
        </Alert>
        <div className="mt-5 flex gap-3">
          <ButtonLink href="/track">অর্ডার ট্র্যাক করুন</ButtonLink>
          <ButtonLink href="/books" variant="outline">বই দেখুন</ButtonLink>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("track_order", {
    p_order_number: savedNumber,
    p_phone: savedPhone,
  });

  const result = data as TrackOrderResult | null;

  if (!result || !result.ok) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error">অর্ডারের তথ্য আনা যায়নি।</Alert>
        <ButtonLink href="/track" className="mt-5">অর্ডার ট্র্যাক করুন</ButtonLink>
      </div>
    );
  }

  const order = result;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* ------------------------------ সফল বার্তা ------------------------------ */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
        <p className="text-4xl" aria-hidden>✅</p>
        <h1 className="mt-3 text-2xl font-bold text-emerald-950">
          ধন্যবাদ! আপনার অর্ডার পেয়েছি
        </h1>
        <p className="prose-bn mt-2 text-sm text-emerald-900">
          আমাদের প্রতিনিধি শীঘ্রই <strong>{order.order_number}</strong> নম্বর অর্ডারটি
          নিশ্চিত করতে আপনার মোবাইলে কল দেবেন।
        </p>

        <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-xl bg-white px-5 py-3 text-sm">
          <span className="text-stone-600">
            অর্ডার নম্বর:{" "}
            <strong className="tabular text-stone-900">{order.order_number}</strong>
          </span>
          <span className="text-stone-600">
            সময়: <strong className="text-stone-900">{formatDateTimeBn(order.created_at)}</strong>
          </span>
        </div>
      </div>

      {/* -------------------------------- বিস্তারিত -------------------------------- */}
      <div className="mt-6 space-y-5">
        <Card>
          <CardHeader title="অর্ডারের অবস্থা" />
          <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <span className="text-stone-500">স্টেটাস</span>
              <p className="font-medium text-stone-900">
                {ORDER_STATUS_LABEL_BN[order.status]}
              </p>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-stone-500">পেমেন্ট</span>
              <p className="font-medium text-stone-900">
                {PAYMENT_METHOD_LABEL_BN[order.payment_method]} —{" "}
                {PAYMENT_STATUS_LABEL_BN[order.payment_status]}
              </p>
            </div>
            {order.courier && (
              <div className="flex justify-between sm:block">
                <span className="text-stone-500">কুরিয়ার</span>
                <p className="font-medium text-stone-900">{order.courier}</p>
              </div>
            )}
            {order.tracking_code && (
              <div className="flex justify-between sm:block">
                <span className="text-stone-500">ট্র্যাকিং কোড</span>
                <p className="tabular font-medium text-stone-900">{order.tracking_code}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={`বই (${toBanglaDigits(order.items.length)}টি)`} />
          <ul className="divide-y divide-stone-100">
            {order.items.map((item, i) => (
              <li key={`${item.title}-${i}`} className="flex items-center gap-4 px-5 py-4">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                  {item.cover ? (
                    <Image src={item.cover} alt={item.title} fill sizes="56px" className="object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-xl">📗</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-stone-900">{item.title}</p>
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
        </Card>

        <Card>
          <CardHeader title="হিসাব" />
          <dl className="space-y-2.5 px-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">সাবটোটাল</dt>
              <dd className="tabular font-medium">{formatTaka(order.subtotal, { symbol: true })}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>ছাড়</dt>
                <dd className="tabular font-medium">− {formatTaka(order.discount, { symbol: true })}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-stone-600">ডেলিভারি চার্জ</dt>
              <dd className="tabular font-medium">
                {order.delivery_fee === 0 ? "ফ্রি" : formatTaka(order.delivery_fee, { symbol: true })}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-stone-200 pt-3">
              <dt className="font-semibold text-stone-900">সর্বমোট</dt>
              <dd className="tabular text-lg font-bold text-emerald-900">
                {formatTaka(order.total, { symbol: true })}
              </dd>
            </div>
          </dl>
        </Card>

        {/* -------------------------------- পরবর্তী -------------------------------- */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
          <h2 className="text-sm font-semibold text-stone-900">এরপর কী হবে?</h2>
          <ol className="prose-bn mt-3 space-y-2 text-sm text-stone-700">
            <li>১. আমরা ফোন করে অর্ডার নিশ্চিত করব।</li>
            <li>
              ২. বই প্যাক করে কুরিয়ারে দেওয়া হবে
              {order.payment_method === "cod" ? " (" + PAYMENT_METHOD_LABEL_BN.cod + ")" : ""}।
            </li>
            <li>৩. কুরিয়ার আপনাকে কল দিয়ে বই পৌঁছে দেবে।</li>
            {order.payment_method === "cod" ? (
              <li>৪. বই হাতে পেয়ে টাকা পরিশোধ করবেন।</li>
            ) : (
              <li>৪. আপনার পেমেন্ট আমরা যাচাই করে নিশ্চিত করব।</li>
            )}
          </ol>

          {settings.contact_phone && (
            <p className="mt-4 text-sm text-stone-700">
              যেকোনো প্রশ্নে কল করুন:{" "}
              <a href={`tel:${settings.contact_phone}`} className="font-medium text-emerald-800">
                {settings.contact_phone}
              </a>
            </p>
          )}

          <div className="no-print mt-5 flex flex-wrap gap-3">
            <Link
              href="/books"
              className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-900"
            >
              আরও বই কিনুন
            </Link>
            <Link
              href="/track"
              className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              অর্ডার ট্র্যাক করুন
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>
    </div>
  );
}
