import Link from "next/link";
import { BookCard } from "@/components/book-card";
import { ButtonLink, EmptyState } from "@/components/ui";
import { getCategories, getFeaturedBooks, getNewArrivals } from "@/lib/queries";
import { getPublicSettings } from "@/lib/settings";

export const revalidate = 300; // ৫ মিনিটে একবার রিফ্রেশ — Supabase egress বাঁচে

export default async function HomePage() {
  const [settings, categories, featured, newArrivals] = await Promise.all([
    getPublicSettings(),
    getCategories(),
    getFeaturedBooks(8),
    getNewArrivals(8),
  ]);

  return (
    <>
      {/* ------------------------------- হিরো ------------------------------- */}
      <section className="border-b border-stone-200 bg-gradient-to-b from-emerald-50 to-stone-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold leading-tight text-emerald-950 sm:text-4xl">
              {settings.hero_title}
            </h1>
            <p className="prose-bn mt-4 text-base text-stone-700 sm:text-lg">
              {settings.hero_subtitle}
            </p>

            {/*
              সাধারণ HTML GET ফর্ম — JavaScript ছাড়াও কাজ করে।
              সাবমিট করলে /books?q=... এ চলে যায় (ব্রাউজার নিজেই করে)।
            */}
            <form action="/books" method="get" className="mt-8 flex gap-2" role="search">
              <input
                type="search"
                name="q"
                placeholder="বইয়ের নাম, লেখক বা প্রকাশনী..."
                aria-label="বই খুঁজুন"
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-emerald-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900"
              >
                খুঁজুন
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-stone-600">
              <span>✅ ক্যাশ অন ডেলিভারি</span>
              <span>🚚 সারা দেশে ডেলিভারি</span>
              <span>↩️ ৭ দিনে ফেরত</span>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- ক্যাটাগরি ----------------------------- */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="mb-5 text-xl font-bold text-stone-900">বিভাগ অনুযায়ী দেখুন</h2>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/books?category=${encodeURIComponent(c.slug)}`}
                className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-900"
              >
                {c.icon && <span className="mr-1.5">{c.icon}</span>}
                {c.name_bn}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* --------------------------- ফিচার্ড বই --------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900">নির্বাচিত বই</h2>
            <p className="mt-1 text-sm text-stone-600">আমাদের বাছাই করা সেরা বইগুলো</p>
          </div>
          <Link href="/books" className="shrink-0 text-sm font-medium text-emerald-800 hover:underline">
            সব দেখুন →
          </Link>
        </div>

        {featured.length === 0 ? (
          <EmptyState
            title="এখনো কোনো বই যোগ করা হয়নি"
            description="অ্যাডমিন প্যানেল থেকে বই যোগ করলে এখানে দেখা যাবে।"
            action={<ButtonLink href="/admin/books" size="sm">বই যোগ করুন</ButtonLink>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((book, i) => (
              <BookCard key={book.id} book={book} priority={i < 4} />
            ))}
          </div>
        )}
      </section>

      {/* --------------------------- নতুন এসেছে --------------------------- */}
      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-xl font-bold text-stone-900">সদ্য এসেছে</h2>
            <Link
              href="/books?sort=new"
              className="shrink-0 text-sm font-medium text-emerald-800 hover:underline"
            >
              সব দেখুন →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {newArrivals.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------ তথ্য ------------------------------ */}
      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:grid-cols-3">
          {[
            { icon: "💵", title: "হাতে পেয়ে টাকা দিন", body: "সারা দেশে ক্যাশ অন ডেলিভারি সুবিধা।" },
            { icon: "📱", title: "bKash / Nagad", body: "অগ্রিম পেমেন্টে দ্রুত ডেলিভারি।" },
            { icon: "↩️", title: "সহজ ফেরত", body: "বইয়ে সমস্যা থাকলে ৭ দিনের মধ্যে ফেরত।" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-2xl" aria-hidden>{f.icon}</p>
              <p className="mt-3 font-semibold text-stone-900">{f.title}</p>
              <p className="prose-bn mt-1 text-sm text-stone-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
