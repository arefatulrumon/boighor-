"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { MAX_CART_LINES } from "@/lib/constants";
import { formatTaka, toBanglaDigits } from "@/lib/format";
import { Button, ButtonLink, Container, EmptyState } from "@/components/ui";

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
      <Container className="max-w-4xl py-16 text-center text-sm text-stone-500">
        কার্ট লোড হচ্ছে...
      </Container>
    );
  }

  if (lines.length === 0) {
    return (
      <Container className="max-w-4xl py-16">
        <h1 className="font-display mb-7 text-3xl text-stone-900">আপনার কার্ট</h1>
        <EmptyState
          icon="🛒"
          title="কার্ট এখন খালি"
          description="পছন্দের বই যোগ করে অর্ডার সম্পন্ন করুন।"
          action={<ButtonLink href="/books">বই দেখুন</ButtonLink>}
        />
      </Container>
    );
  }

  return (
    <Container className="max-w-6xl py-8 sm:py-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h1 className="font-display text-3xl text-stone-900">
          আপনার কার্ট{" "}
          <span className="tabular text-base font-normal text-stone-500">
            ({toBanglaDigits(itemCount)}টি বই)
          </span>
        </h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-rose-700 transition-colors hover:underline"
        >
          কার্ট খালি করুন
        </button>
      </div>

      {/*
        ⚠️ `items-start` জরুরি — নাহলে গ্রিডের নিয়মে বাঁ দিকের কার্ডটা
        ডান দিকের সারসংক্ষেপের উচ্চতা পর্যন্ত টেনে লম্বা হয়ে যায়,
        আর একটা আইটেম থাকলে নিচে বড় ফাঁকা সাদা জায়গা তৈরি হয়।
      */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* ------------------------------- আইটেম ------------------------------- */}
        <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft">
          {lines.map((line) => (
            <div key={line.book_id} className="flex gap-4 p-4 sm:p-5">
              <Link
                href={`/books/${line.slug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 sm:size-24"
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
                  className="line-clamp-2 text-sm font-semibold text-stone-900 transition-colors hover:text-brand-800"
                >
                  {line.title}
                </Link>
                {line.author && (
                  <p className="mt-1 line-clamp-1 text-xs text-stone-600">{line.author}</p>
                )}

                <p className="font-display tabular mt-2 text-base text-brand-900">
                  {formatTaka(line.price, { symbol: true })}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                  {/* কোয়ান্টিটি কন্ট্রোল */}
                  <div className="inline-flex items-center rounded-xl border border-stone-300">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.book_id, line.quantity - 1)}
                      disabled={line.quantity <= 1}
                      className="px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-transparent"
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
                      className="px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="এক কপি বাড়ান"
                    >
                      +
                    </button>
                  </div>

                  {line.quantity >= line.stock_qty && (
                    <span className="text-xs text-amber-700">
                      সর্বোচ্চ স্টক পর্যন্ত নেওয়া হয়েছে
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => remove(line.book_id)}
                    className="ml-auto text-xs text-rose-700 transition-colors hover:underline"
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
            <p className="bg-amber-50 px-5 py-3 text-xs text-amber-800">
              এক অর্ডারে সর্বোচ্চ {toBanglaDigits(MAX_CART_LINES)} ধরনের বই নেওয়া যায়।
            </p>
          )}
        </div>

        {/* ------------------------------ সারসংক্ষেপ ------------------------------ */}
        <aside className="h-fit lg:sticky lg:top-24">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg text-stone-900">হিসাব</h2>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-600">সাবটোটাল</dt>
                <dd className="tabular font-medium">
                  {formatTaka(subtotal, { symbol: true })}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600">ডেলিভারি চার্জ</dt>
                <dd className="text-xs text-stone-500">চেকআউটে হিসাব হবে</dd>
              </div>
            </dl>

            <div className="mt-5 flex items-baseline justify-between border-t border-stone-100 pt-5">
              <span className="font-display text-stone-900">সর্বমোট (আনুমানিক)</span>
              <span className="font-display tabular text-xl text-brand-900">
                {formatTaka(subtotal, { symbol: true })}
              </span>
            </div>

            <ButtonLink href="/checkout" size="lg" className="mt-6 w-full">
              অর্ডার করুন
            </ButtonLink>

            <Link
              href="/books"
              className="mt-3.5 block text-center text-sm font-medium text-brand-800 transition-colors hover:text-brand-900"
            >
              আরও বই দেখুন
            </Link>

            <p className="mt-5 border-t border-stone-100 pt-5 text-xs text-stone-500">
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
    </Container>
  );
}
