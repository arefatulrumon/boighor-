import type { Metadata } from "next";
import Link from "next/link";
import { BookCard } from "@/components/book-card";
import { ButtonLink, Container, EmptyState, cn } from "@/components/ui";
import { BOOKS_PER_PAGE } from "@/lib/constants";
import { getBooks, getCategories, type BookSort } from "@/lib/queries";
import { toBanglaDigits } from "@/lib/format";

/**
 * ⚠️ Next.js 15+ এ `searchParams` একটি Promise — await করতে হয়।
 *    (আগের ভার্সনে সরাসরি অবজেক্ট ছিল।)
 */
type SearchParams = Promise<{
  q?: string;
  category?: string;
  sort?: string;
  page?: string;
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  if (sp.q) return { title: `"${sp.q}" এর ফলাফল` };
  return { title: "সব বই" };
}

const SORT_OPTIONS: Array<{ value: BookSort; label: string }> = [
  { value: "featured", label: "নির্বাচিত" },
  { value: "new", label: "নতুন" },
  { value: "price_asc", label: "দাম: কম থেকে বেশি" },
  { value: "price_desc", label: "দাম: বেশি থেকে কম" },
  { value: "title", label: "নাম অনুযায়ী" },
];

/** ফিল্টার/সর্টের চিপ — একই দেখতে হয় সব জায়গায় */
const CHIP_BASE = "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors";
const CHIP_ON = "border-brand-800 bg-brand-800 text-white";
const CHIP_OFF = "border-stone-300 bg-white text-stone-700 hover:border-brand-700 hover:bg-brand-50 hover:text-brand-900";

function buildUrl(
  base: { q?: string; category?: string; sort?: string },
  overrides: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...overrides };

  Object.entries(merged).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    // page=1 হলে URL এ না দেখানোই ভালো (পরিষ্কার লিংক)
    if (key === "page" && String(value) === "1") return;
    params.set(key, String(value));
  });

  const qs = params.toString();
  return qs ? `/books?${qs}` : "/books";
}

export default async function BooksPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const categorySlug = sp.category ?? "";
  const sort = (SORT_OPTIONS.find((o) => o.value === sp.sort)?.value ??
    "featured") as BookSort;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ books, total }, categories] = await Promise.all([
    getBooks({ q, categorySlug, sort, page, perPage: BOOKS_PER_PAGE }),
    getCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / BOOKS_PER_PAGE));
  const activeCategory = categories.find((c) => c.slug === categorySlug);
  const base = { q, category: categorySlug, sort };

  return (
    <Container className="py-8 sm:py-10">
      {/* ----------------------------- ব্রেডক্রাম্ব ----------------------------- */}
      <nav className="mb-6 text-sm text-stone-600">
        <Link href="/" className="transition-colors hover:text-brand-800">
          হোম
        </Link>
        <span className="mx-2 text-stone-400">/</span>
        <span className="text-stone-900">সব বই</span>
        {activeCategory && (
          <>
            <span className="mx-2 text-stone-400">/</span>
            <span className="text-stone-900">{activeCategory.name_bn}</span>
          </>
        )}
      </nav>

      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-display text-3xl text-stone-900 sm:text-[2rem]">
            {q ? `"${q}" এর ফলাফল` : activeCategory ? activeCategory.name_bn : "সব বই"}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {total > 0
              ? `${toBanglaDigits(total)}টি বই পাওয়া গেছে`
              : "কোনো বই পাওয়া যায়নি"}
          </p>
        </div>

        {/* সর্টিং — লিংক হিসেবে, JavaScript লাগে না */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SORT_OPTIONS.map((o) => (
            <Link
              key={o.value}
              href={buildUrl(base, { sort: o.value, page: 1 })}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                sort === o.value
                  ? CHIP_ON
                  : "border-stone-300 bg-white text-stone-700 hover:border-brand-700 hover:bg-brand-50"
              )}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      {/* --------------------------- ক্যাটাগরি ফিল্টার --------------------------- */}
      <div className="no-scrollbar -mx-4 mb-8 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        <Link
          href={buildUrl({ q, sort }, { category: undefined, page: 1 })}
          className={cn(CHIP_BASE, !categorySlug ? CHIP_ON : CHIP_OFF)}
        >
          সব
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={buildUrl({ q, sort }, { category: c.slug, page: 1 })}
            className={cn(CHIP_BASE, categorySlug === c.slug ? CHIP_ON : CHIP_OFF)}
          >
            {c.name_bn}
          </Link>
        ))}
      </div>

      {/* -------------------------------- ফলাফল -------------------------------- */}
      {books.length === 0 ? (
        <EmptyState
          title="কোনো বই পাওয়া যায়নি"
          description={
            q
              ? `"${q}" দিয়ে কিছু খুঁজে পাওয়া গেল না। অন্য শব্দে চেষ্টা করুন।`
              : "এই বিভাগে এখনো বই যোগ করা হয়নি।"
          }
          action={
            <ButtonLink href="/books" size="sm" variant="outline">
              সব বই দেখুন
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {books.map((book, i) => (
              <BookCard key={book.id} book={book} priority={i < 4} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-12 flex items-center justify-center gap-3" aria-label="পেজ">
              {page > 1 && (
                <Link
                  href={buildUrl(base, { page: page - 1 })}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium transition-colors hover:border-brand-700 hover:bg-brand-50"
                >
                  ← আগের
                </Link>
              )}
              <span className="tabular px-3 text-sm text-stone-600">
                পেজ {toBanglaDigits(page)} / {toBanglaDigits(totalPages)}
              </span>
              {page < totalPages && (
                <Link
                  href={buildUrl(base, { page: page + 1 })}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium transition-colors hover:border-brand-700 hover:bg-brand-50"
                >
                  পরের →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </Container>
  );
}
