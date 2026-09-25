"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { MAX_CART_LINES } from "@/lib/constants";
import { formatTaka, toBanglaDigits } from "@/lib/format";
import { Button, ButtonLink, EmptyState, cn } from "@/components/ui";

/**
 * কার্ট পেজ — পুরোটাই ক্লায়েন্ট-সাইড (localStorage থেকে পড়া)।
 * তাই সাথে সাথে লোড হয়, কোনো সার্ভার রিকোয়েস্ট লাগে না।
 *
 * দাম এখানে শুধু দেখানোর জন্য — অর্ডার করার সময় ডেটাবেস আবার হিসাব করে।
 */
export default function CartPage() {
  const { lines, ready, itemCount, subtotal, setQuantity, remove, clear } = useCart();

  if (!ready) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-stone-500">
        কার্ট লোড হচ্ছে...
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="mb-6 text-2xl font-bold text-stone-900">আপনার কার্ট</h1>
        <EmptyState
          title="কার্ট এখন খালি"
          description="পছন্দের বই যোগ করে অর্ডার সম্পন্ন করুন।"
          action={<ButtonLink href="/books">বই দেখুন</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">
          আপনার কার্ট{" "}
          <span className="tabular text-base font-normal text-stone-500">
            ({toBanglaDigits(itemCount)}টি বই)
          </span>
        </h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-rose-700 hover:underline"
        >
          কার্ট খালি করুন
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ------------------------------- আইটেম ------------------------------- */}
        <div className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {lines.map((line) => (
            <div key={line.book_id} className="flex gap-4 p-4">
              <Link
                href={`/books/${line.slug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 sm:size-24"
              >
                {line.cover ? (
                  <Image
                    src={line.cover}
                    alt={line.title}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-2xl">📗</span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/books/${line.slug}`}
                  className="line-clamp-2 text-sm font-semibold text-stone-900 hover:text-emerald-800"
                >
                  {line.title}
                </Link>
                {line.author && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-stone-600">{line.author}</p>
                )}

                <p className="tabular mt-2 text-sm font-bold text-emerald-900">
                  {formatTaka(line.price, { symbol: true })}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                  {/* কোয়ান্টিটি কন্ট্রোল */}
                  <div className="inline-flex items-center rounded-lg border border-stone-300">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.book_id, line.quantity - 1)}
                      disabled={line.quantity <= 1}
                      className="px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                      aria-label="এক কপি কমান"
                    >
                      −
                    </button>
                    <span className="tabular w-9 text-center text-sm font-medium">
                      {toBanglaDigits(line.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.book_id, line.quantity + 1)}
                      disabled={line.quantity >= line.stock_qty}
                      className="px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                      aria-label="এক কপি বাড়ান"
                    >
                      +
                    </button>
                  </div>

                  {line.quantity >= line.stock_qty && (
                    <span className="text-xs text-amber-700">সর্বোচ্চ স্টক পর্যন্ত নেওয়া হয়েছে</span>
                  )}

                  <button
                    type="button"
                    onClick={() => remove(line.book_id)}
                    className="ml-auto text-xs text-rose-700 hover:underline"
                  >
                    সরিয়ে ফেলুন
                  </button>
                </div>
              </div>

              <div className="tabular hidden shrink-0 text-right text-sm font-semibold text-stone-900 sm:block">
                {formatTaka(line.price * line.quantity, { symbol: true })}
              </div>
            </div>
          ))}

          {lines.length >= MAX_CART_LINES && (
            <p className="bg-amber-50 px-4 py-3 text-xs text-amber-800">
              এক অর্ডারে সর্বোচ্চ {toBanglaDigits(MAX_CART_LINES)} ধরনের বই নেওয়া যায়।
            </p>
          )}
        </div>

        {/* ------------------------------ সারসংক্ষেপ ------------------------------ */}
        <aside className="h-fit lg:sticky lg:top-24">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="text-base font-semibold text-stone-900">হিসাব</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-600">সাবটোটাল</dt>
                <dd className="tabular font-medium">{formatTaka(subtotal, { symbol: true })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600">ডেলিভারি চার্জ</dt>
                <dd className="text-xs text-stone-500">চেকআউটে হিসাব হবে</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-stone-200 pt-4">
              <span className="font-semibold text-stone-900">সর্বমোট (আনুমানিক)</span>
              <span className="tabular text-lg font-bold text-emerald-900">
                {formatTaka(subtotal, { symbol: true })}
              </span>
            </div>

            <ButtonLink href="/checkout" size="lg" className={cn("mt-5 w-full")}>
              অর্ডার করুন
            </ButtonLink>

            <Link
              href="/books"
              className="mt-3 block text-center text-sm text-emerald-800 hover:underline"
            >
              আরও বই দেখুন
            </Link>

            <p className="mt-4 border-t border-stone-100 pt-4 text-xs text-stone-500">
              💵 ক্যাশ অন ডেলিভারি — বই হাতে পেয়ে টাকা দিতে পারবেন।
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="mt-3 w-full"
          >
            ← আরও কিনুন
          </Button>
        </aside>
      </div>
    </div>
  );
}
