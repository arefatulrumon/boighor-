import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { Alert, ButtonLink, Card, CardHeader, Container } from "@/components/ui";
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
      <Container className="max-w-2xl py-16">
        <Alert tone="warning">
          এই অর্ডারের তথ্য দেখাতে অর্ডার নম্বর ও মোবাইল নম্বর দুটোই লাগবে।
        </Alert>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/track">অর্ডার ট্র্যাক করুন</ButtonLink>
          <ButtonLink href="/books" variant="outline">
            বই দেখুন
          </ButtonLink>
        </div>
      </Container>
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
      <Container className="max-w-2xl py-16">
        <Alert tone="error">অর্ডারের তথ্য আনা যায়নি।</Alert>
        <ButtonLink href="/track" className="mt-6">
          অর্ডার ট্র্যাক করুন
        </ButtonLink>
      </Container>
    );
  }

  const order = result;

  return (
    <Container className="max-w-3xl py-10 sm:py-12">
      {/* ------------------------------ সফল বার্তা ------------------------------ */}
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-b from-brand-50 to-white p-6 text-center shadow-soft sm:p-9">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-800 text-2xl text-white" aria-hidden>
          ✓
        </span>
        <h1 className="font-display mt-5 text-3xl text-brand-950">
          ধন্যবাদ! আপনার অর্ডার পেয়েছি
        </h1>
        <p className="prose-bn mx-auto mt-3 max-w-lg text-sm text-stone-700">
          আমাদের প্রতিনিধি শীঘ্রই <strong>{order.order_number}</strong> নম্বর অর্ডারটি
          নিশ্চিত করতে আপনার মোবাইলে কল দেবেন।
        </p>

        <div className="mt-7 inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl bg-white px-6 py-4 text-sm shadow-soft">
          <span className="text-stone-600">
            অর্ডার নম্বর:{" "}
            <strong className="tabular font-display text-base text-stone-900">
              {order.order_number}
            </strong>
          </span>
          <span className="text-stone-600">
            সময়:{" "}
            <strong className="text-stone-900">{formatDateTimeBn(order.created_at)}</strong>
          </span>
        </div>
      </div>

      {/* -------------------------------- বিস্তারিত -------------------------------- */}
      <div className="mt-6 space-y-5">
        <Card>
          <CardHeader title="অর্ডারের অবস্থা" />
          <div className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-2 sm:px-6 sm:py-5">
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
              <li key={`${item.title}-${i}`} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                  {item.cover ? (
                    <Image
                      src={item.cover}
                      alt={item.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-xl">📗</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-stone-900">{item.title}</p>
                  <p className="tabular mt-1 text-xs text-stone-500">
                    {formatTaka(item.unit_price, { symbol: true })} ×{" "}
                    {toBanglaDigits(item.quantity)}
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
          <dl className="space-y-3 px-5 py-4 text-sm sm:px-6 sm:py-5">
            <div className="flex justify-between">
              <dt className="text-stone-600">সাবটোটাল</dt>
              <dd className="tabular font-medium">
                {formatTaka(order.subtotal, { symbol: true })}
              </dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-brand-700">
                <dt>ছাড়</dt>
                <dd className="tabular font-medium">
                  − {formatTaka(order.discount, { symbol: true })}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-stone-600">ডেলিভারি চার্জ</dt>
              <dd className="tabular font-medium">
                {order.delivery_fee === 0
                  ? "ফ্রি"
                  : formatTaka(order.delivery_fee, { symbol: true })}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-stone-100 pt-3.5">
              <dt className="font-display text-stone-900">সর্বমোট</dt>
              <dd className="font-display tabular text-xl text-brand-900">
                {formatTaka(order.total, { symbol: true })}
              </dd>
            </div>
          </dl>
        </Card>

        {/* -------------------------------- পরবর্তী -------------------------------- */}
        <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-6">
          <h2 className="font-display text-base text-stone-900">এরপর কী হবে?</h2>
          <ol className="prose-bn mt-4 space-y-2.5 text-sm text-stone-700">
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
            <p className="mt-5 text-sm text-stone-700">
              যেকোনো প্রশ্নে কল করুন:{" "}
              <a
                href={`tel:${settings.contact_phone}`}
                className="tabular font-medium text-brand-800"
              >
                {settings.contact_phone}
              </a>
            </p>
          )}

          <div className="no-print mt-6 flex flex-wrap gap-3">
            <Link
              href="/books"
              className="inline-flex items-center justify-center rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-900"
            >
              আরও বই কিনুন
            </Link>
            <Link
              href="/track"
              className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 transition-colors hover:border-brand-700 hover:bg-brand-50/60"
            >
              অর্ডার ট্র্যাক করুন
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>
    </Container>
  );
}
