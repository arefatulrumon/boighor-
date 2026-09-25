"use client";

import { useEffect, useState } from "react";
import { BookCard } from "@/components/book-card";
import { Button, ButtonLink, EmptyState } from "@/components/ui";
import { getBooksByIds } from "@/lib/actions/wishlist";
import { toBanglaDigits } from "@/lib/format";
import { useWishlist } from "@/lib/wishlist";
import type { BookWithCategory } from "@/types/database";

/**
 * ইচ্ছেতালিকা পেজ।
 *
 * ক্লায়েন্ট কম্পোনেন্ট — কারণ আইডিগুলো localStorage এ থাকে, সার্ভার
 * সেগুলো জানতে পারে না। আইডি পেয়ে বইয়ের তথ্য Server Action দিয়ে আনা হয়।
 */
export default function WishlistPage() {
  const { ids, ready, clear } = useWishlist();
  const [books, setBooks] = useState<BookWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;

    if (ids.length === 0) {
      setBooks([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getBooksByIds(ids)
      .then((result) => {
        if (!cancelled) setBooks(result);
      })
      .catch(() => {
        if (!cancelled) setBooks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ids, ready]);

  if (!ready || loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-stone-500">
        লোড হচ্ছে...
      </div>
    );
  }

  // কোনো আইডি আছে কিন্তু বই পাওয়া গেল না → বইগুলো এখন বন্ধ/মুছে ফেলা
  const unavailable = ids.length - books.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">ইচ্ছেতালিকা</h1>
          <p className="mt-1 text-sm text-stone-600">
            {books.length > 0
              ? `${toBanglaDigits(books.length)}টি বই পরে কেনার জন্য রেখেছেন`
              : "পরে কেনার বই এখানে জমা রাখুন"}
          </p>
        </div>

        {books.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            তালিকা খালি করুন
          </Button>
        )}
      </div>

      {books.length === 0 ? (
        <EmptyState
          title="তালিকা এখন খালি"
          description="যেকোনো বইয়ের কার্ডে ♡ চাপলে সেটি এখানে জমা হবে। লগইন লাগবে না — এই ব্রাউজারেই থাকবে।"
          action={<ButtonLink href="/books">বই দেখুন</ButtonLink>}
        />
      ) : (
        <>
          {unavailable > 0 && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
              আপনার তালিকার {toBanglaDigits(unavailable)}টি বই এখন আর পাওয়া যাচ্ছে না —
              সম্ভবত স্টক থেকে সরিয়ে ফেলা হয়েছে।
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((book, i) => (
              <BookCard key={book.id} book={book} priority={i < 4} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
