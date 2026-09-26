import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { BookCard } from "@/components/book-card";
import { Badge, ButtonLink, Container, SectionHeading } from "@/components/ui";
import {
  BOOK_BINDING_LABEL_BN,
  BOOK_LANGUAGE_LABEL_BN,
} from "@/lib/constants";
import { discountPercent, formatTaka, stockState, toBanglaDigits } from "@/lib/format";
import { getApprovedReviews, getBookBySlug, getRelatedBooks } from "@/lib/queries";

export const revalidate = 300;

/** Next.js 16 এ `params` ও একটি Promise। */
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBookBySlug(slug);

  if (!book) return { title: "বই পাওয়া যায়নি" };

  const title = book.seo_title || book.title_bn;
  const description =
    book.seo_description ||
    book.description_bn?.slice(0, 155) ||
    `${book.title_bn} — ${book.author ?? ""}। অনলাইনে অর্ডার করুন, ক্যাশ অন ডেলিভারি।`;

  return {
    title,
    description,
    alternates: { canonical: `/books/${book.slug ?? book.id}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: book.cover_image_url ? [{ url: book.cover_image_url }] : undefined,
    },
  };
}

export default async function BookDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);

  if (!book) notFound();

  const [reviews, related] = await Promise.all([
    getApprovedReviews(book.id),
    getRelatedBooks(book.id, book.category_id, 4),
  ]);

  const off = discountPercent(book.price, book.compare_at_price);
  const stock = stockState(book.stock_qty, book.low_stock_threshold);
  const gallery = Array.isArray(book.gallery) ? book.gallery : [];
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  const specs: Array<[string, string]> = [
    ["লেখক", book.author ?? "—"],
    ...(book.translator ? ([[ "অনুবাদক", book.translator]] as Array<[string, string]>) : []),
    ["প্রকাশনী", book.publisher ?? "—"],
    ["ভাষা", BOOK_LANGUAGE_LABEL_BN[book.language]],
    ["বাঁধাই", BOOK_BINDING_LABEL_BN[book.binding]],
    ...(book.pages ? ([[ "পৃষ্ঠা", toBanglaDigits(book.pages)]] as Array<[string, string]>) : []),
    ...(book.publication_year
      ? ([[ "প্রকাশকাল", toBanglaDigits(book.publication_year)]] as Array<[string, string]>)
      : []),
    ...(book.isbn ? ([[ "ISBN", book.isbn]] as Array<[string, string]>) : []),
    ...(book.edition ? ([[ "সংস্করণ", book.edition]] as Array<[string, string]>) : []),
  ];

  // স্ট্রাকচার্ড ডেটা — Google এ দাম/স্টক দেখাতে সাহায্য করে
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title_bn,
    ...(book.title_en ? { alternateName: book.title_en } : {}),
    ...(book.author ? { author: { "@type": "Person", name: book.author } } : {}),
    ...(book.publisher ? { publisher: { "@type": "Organization", name: book.publisher } } : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.pages ? { numberOfPages: book.pages } : {}),
    ...(book.cover_image_url ? { image: book.cover_image_url } : {}),
    offers: {
      "@type": "Offer",
      price: book.price,
      priceCurrency: "BDT",
      availability:
        book.stock_qty > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <Container className="py-8 sm:py-10">
      <script
        type="application/ld+json"
        /*
         * ⚠️ `<` কে `\u003c` করে এস্কেপ করা হয়েছে।
         * JSON.stringify নিজে থেকে এটা করে না — তাই বইয়ের নাম/লেখকের
         * নামে `</script>` থাকলে স্ক্রিপ্ট ব্লকটা ভেঙে যেত।
         * দৃশ্যমান আউটপুট একই থাকে, শুধু নিরাপদ হয়।
         */
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <nav className="mb-7 text-sm text-stone-600">
        <Link href="/" className="transition-colors hover:text-brand-800">
          হোম
        </Link>
        <span className="mx-2 text-stone-400">/</span>
        <Link href="/books" className="transition-colors hover:text-brand-800">
          সব বই
        </Link>
        {book.category && (
          <>
            <span className="mx-2 text-stone-400">/</span>
            <Link
              href={`/books?category=${encodeURIComponent(book.category.slug)}`}
              className="transition-colors hover:text-brand-800"
            >
              {book.category.name_bn}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
        {/* --------------------------- কভার + গ্যালারি --------------------------- */}
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-100 shadow-lift">
            {book.cover_image_url ? (
              <Image
                src={book.cover_image_url}
                alt={book.title_bn}
                fill
                sizes="(max-width: 1024px) 90vw, 380px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="text-5xl" aria-hidden>
                  📗
                </span>
                <span className="font-medium text-brand-900">{book.title_bn}</span>
              </div>
            )}
            {off !== null && (
              <span className="tabular absolute left-3 top-3 rounded-xl bg-accent-600 px-3 py-1.5 text-sm font-semibold text-white shadow-soft">
                {toBanglaDigits(off)}% ছাড়
              </span>
            )}
          </div>

          {gallery.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {gallery.slice(0, 8).map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-100 transition-colors hover:border-brand-700"
                >
                  <Image
                    src={url}
                    alt={`${book.title_bn} — ছবি ${i + 1}`}
                    fill
                    sizes="90px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ----------------------------- মূল তথ্য ----------------------------- */}
        <div className="flex flex-col">
          <h1 className="font-display text-3xl text-stone-900 sm:text-4xl">
            {book.title_bn}
          </h1>
          {book.title_en && <p className="mt-2 text-sm text-stone-500">{book.title_en}</p>}

          {book.author && (
            <p className="mt-4 text-sm text-stone-700">
              লেখক: <span className="font-medium text-brand-900">{book.author}</span>
            </p>
          )}

          {avgRating !== null && (
            <p className="mt-2.5 text-sm text-amber-600">
              {"★".repeat(Math.round(avgRating))}
              <span className="tabular ml-2 text-stone-600">
                {toBanglaDigits(avgRating)} / ৫ ({toBanglaDigits(reviews.length)}টি রিভিউ)
              </span>
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <span className="font-display tabular text-4xl text-brand-900">
              {formatTaka(book.price, { symbol: true })}
            </span>
            {book.compare_at_price && book.compare_at_price > book.price && (
              <span className="tabular text-base text-stone-400 line-through">
                {formatTaka(book.compare_at_price, { symbol: true })}
              </span>
            )}
          </div>

          <div className="mt-4">
            {book.stock_qty > 0 ? (
              <Badge className="border-brand-200 bg-brand-50 text-brand-800">
                ✓ স্টকে আছে
                {stock.tone === "low" && ` — ${stock.label}`}
              </Badge>
            ) : (
              <Badge className="border-rose-200 bg-rose-50 text-rose-700">স্টক শেষ</Badge>
            )}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <AddToCartButton
              size="lg"
              book={{
                book_id: book.id,
                slug: book.slug ?? book.id,
                title: book.title_bn,
                author: book.author,
                cover: book.cover_image_url,
                price: book.price,
                stock_qty: book.stock_qty,
              }}
            />
            <ButtonLink href="/cart" variant="outline" size="lg">
              কার্ট দেখুন
            </ButtonLink>
          </div>

          <dl className="mt-9 divide-y divide-stone-100 border-y border-stone-200">
            {specs.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-3 text-sm">
                <dt className="text-stone-500">{label}</dt>
                <dd className="text-stone-900">{value}</dd>
              </div>
            ))}
          </dl>

          {book.description_bn && (
            <section className="prose-bn mt-9">
              <h2 className="font-display mb-3 text-xl text-stone-900">বইটি সম্পর্কে</h2>
              <p className="whitespace-pre-line text-sm text-stone-700">
                {book.description_bn}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* ------------------------------ রিভিউ ------------------------------ */}
      {reviews.length > 0 && (
        <section className="mt-16">
          <SectionHeading
            title="পাঠকদের মতামত"
            subtitle={`${toBanglaDigits(reviews.length)}টি রিভিউ`}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft"
              >
                <p className="text-sm text-amber-600">{"★".repeat(r.rating)}</p>
                <p className="mt-2.5 text-sm font-semibold text-stone-900">
                  {r.author_name}
                </p>
                {r.comment && (
                  <p className="prose-bn mt-1.5 text-sm text-stone-600">{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------- একই বিভাগের ----------------------------- */}
      {related.length > 0 && (
        <section className="mt-16">
          <SectionHeading title="একই বিভাগের আরও বই" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {related.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
