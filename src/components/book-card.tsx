import Image from "next/image";
import Link from "next/link";
import type { Book } from "@/types/database";
import { discountPercent, formatTaka, stockState } from "@/lib/format";
import { AddToCartButton } from "./add-to-cart-button";
import { WishlistButton } from "./wishlist-button";
import { Badge, cn } from "./ui";

/** কভার না থাকলে টাইটেল দিয়ে একটা সুন্দর প্লেসহোল্ডার বানানো হয়। */
function CoverPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand-50 to-stone-100 p-4 text-center">
      <span className="text-3xl" aria-hidden>
        📗
      </span>
      <span className="line-clamp-3 text-sm font-medium text-brand-900">{title}</span>
      {/* ⚠️ `uppercase` বাংলায় কোনো কাজ করে না — ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে */}
      <span className="text-[10px] text-stone-400">কভার নেই</span>
    </div>
  );
}

/**
 * বইয়ের কার্ড — তালিকা, হোমপেজ ও সম্পর্কিত বইয়ে একই দেখতে হয়।
 *
 * দাম display ফন্টে (সেরিফ) — বইয়ের দোকানের "সম্পাদকীয়" অনুভূতির জন্য,
 * আর সংখ্যাগুলো আলাদা করে চোখে পড়ে।
 */
export function BookCard({
  book,
  priority = false,
  className,
}: {
  book: Book;
  /** প্রথম কয়েকটা কার্ডে true দিলে LCP ইমেজ দ্রুত লোড হয় */
  priority?: boolean;
  className?: string;
}) {
  const slug = book.slug ?? book.id;
  const off = discountPercent(book.price, book.compare_at_price);
  const stock = stockState(book.stock_qty, book.low_stock_threshold);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        className
      )}
    >
      <Link
        href={`/books/${slug}`}
        className="relative block aspect-[3/4] overflow-hidden bg-stone-100"
      >
        {book.cover_image_url ? (
          <Image
            src={book.cover_image_url}
            alt={book.title_bn}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            priority={priority}
          />
        ) : (
          <CoverPlaceholder title={book.title_bn} />
        )}

        {off !== null && (
          <span className="tabular absolute left-2.5 top-2.5 rounded-lg bg-accent-600 px-2 py-1 text-xs font-semibold text-white shadow-soft">
            {off}% ছাড়
          </span>
        )}

        {book.stock_qty <= 0 && (
          <span className="absolute inset-0 flex items-center justify-center bg-stone-900/55 text-sm font-semibold text-white">
            স্টক শেষ
          </span>
        )}
      </Link>

      {/* উইশলিস্ট — ছবির উপরে ভাসমান, তাই Link এর বাইরে রাখা হয়েছে */}
      <div className="relative -mt-9 flex justify-end px-2.5">
        <WishlistButton bookId={book.id} />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900">
          <Link href={`/books/${slug}`} className="transition-colors hover:text-brand-800">
            {book.title_bn}
          </Link>
        </h3>

        {book.author && <p className="line-clamp-1 text-xs text-stone-600">{book.author}</p>}

        <div className="mt-auto space-y-2.5 pt-1.5">
          <div className="flex items-baseline gap-2">
            <span className="font-display tabular text-lg text-brand-900">
              {formatTaka(book.price, { symbol: true })}
            </span>
            {book.compare_at_price && book.compare_at_price > book.price && (
              <span className="tabular text-xs text-stone-400 line-through">
                {formatTaka(book.compare_at_price, { symbol: true })}
              </span>
            )}
          </div>

          {stock.label && (
            <Badge
              className={
                stock.tone === "out"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }
            >
              {stock.label}
            </Badge>
          )}

          <AddToCartButton
            size="sm"
            fullWidth
            book={{
              book_id: book.id,
              slug,
              title: book.title_bn,
              author: book.author,
              cover: book.cover_image_url,
              price: book.price,
              stock_qty: book.stock_qty,
            }}
          />
        </div>
      </div>
    </article>
  );
}
