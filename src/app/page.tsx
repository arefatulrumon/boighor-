import Image from "next/image";
import Link from "next/link";
import { BookCard } from "@/components/book-card";
import {
  ButtonLink,
  Container,
  EmptyState,
  SectionHeading,
  VIEW_ALL_CLASS,
  cn,
} from "@/components/ui";
import { discountPercent, toBanglaDigits } from "@/lib/format";
import { getCategories, getFeaturedBooks, getNewArrivals } from "@/lib/queries";
import { getPublicSettings } from "@/lib/settings";

export const revalidate = 300; // ৫ মিনিটে একবার রিফ্রেশ — Supabase egress বাঁচে

/** হিরোতে যে বইগুলো সাজানো থাকে — কভার আছে যেগুলোর মধ্যে প্রথম তিনটি */
const HERO_COVERS = 3;

export default async function HomePage() {
  const [settings, categories, featured, newArrivals] = await Promise.all([
    getPublicSettings(),
    getCategories(),
    getFeaturedBooks(8),
    getNewArrivals(8),
  ]);

  // হিরোর কভার-কলাজ — শুধু যেগুলোর আসল কভার আছে
  const heroCovers = featured.filter((b) => b.cover_image_url).slice(0, HERO_COVERS);

  /*
   * ⚠️ কভার না থাকলে কলাজটা একেবারে দেখানো হয় না।
   * কারণ তখন দুই-কলামের লেআউটে ডান দিকটা ফাঁকা সবুজ হয়ে থাকত —
   * দেখতে ভাঙা লাগে। কভার নেই মানে হিরো মাঝখানে বসানো (সেন্টার)।
   *
   * বই যোগ করার সাথে সাথেই (কভার সহ) কলাজটা নিজে থেকেই ফিরে আসবে।
   */
  const hasCollage = heroCovers.length > 0;

  /*
   * হোমপেজের প্রোমো কার্ডের ডেটা — সবই বাস্তব, বানানো নয়:
   *   ১) সবচেয়ে বেশি ছাড় যেটিতে, সেটাই "সর্বোচ্চ ছাড়" কার্ড
   *   ২) ফ্রি ডেলিভারির নোটটা site_settings থেকে আসে (অ্যাডমিন প্যানেল থেকে বদলানো যায়)
   * ছাড় পাওয়া কোনো বই না থাকলে কার্ডটা দেখানোই হয় না।
   */
  const bestOffer =
    [...featured, ...newArrivals]
      .map((book) => ({ book, off: discountPercent(book.price, book.compare_at_price) }))
      .filter((x): x is { book: (typeof featured)[number]; off: number } => x.off !== null)
      .sort((a, z) => z.off - a.off)[0] ?? null;

  return (
    <>
      {/* ================================ হিরো ================================ */}
      <section className="hero-panel relative overflow-hidden">
        <Container
          className={cn(
            "py-16 lg:py-24",
            hasCollage && "grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]"
          )}
        >
          <div className={cn(hasCollage ? "max-w-xl" : "mx-auto max-w-2xl text-center")}>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-brand-50">
              <span className="size-1.5 rounded-full bg-accent-500" aria-hidden />
              {settings.store_tagline}
            </p>

            <h1 className="font-display mt-6 text-4xl text-white sm:text-5xl">
              {settings.hero_title}
            </h1>

            <p className="prose-bn mt-5 text-base text-brand-50/85 sm:text-lg">
              {settings.hero_subtitle}
            </p>

            {/*
              সাধারণ HTML GET ফর্ম — JavaScript ছাড়াও কাজ করে।
              সাবমিট করলে /books?q=... এ চলে যায় (ব্রাউজার নিজেই করে)।
            */}
            <form
              action="/books"
              method="get"
              role="search"
              className="mt-8 flex gap-2 rounded-2xl bg-white p-1.5 shadow-lift"
            >
              <input
                type="search"
                name="q"
                placeholder="বইয়ের নাম, লেখক বা প্রকাশনী..."
                aria-label="বই খুঁজুন"
                className="w-full rounded-xl border-0 bg-transparent px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-brand-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-900"
              >
                খুঁজুন
              </button>
            </form>

            {/* প্রতিশ্রুতি — দোকানের প্রকৃত নীতি */}
            <ul
              className={cn(
                "mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-brand-50/80",
                !hasCollage && "justify-center"
              )}
            >
              <li className="flex items-center gap-2">
                <span aria-hidden>✅</span> ক্যাশ অন ডেলিভারি
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden>🚚</span> সারা দেশে ডেলিভারি
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden>↩️</span> ৭ দিনে ফেরত
              </li>
            </ul>
          </div>

          {/* কভার-কলাজ — শুধু কভার থাকলে এবং বড় স্ক্রিনে */}
          {hasCollage && (
            <div className="hidden items-end justify-center gap-4 lg:flex">
              {heroCovers.map((book, i) => (
                <Link
                  key={book.id}
                  href={`/books/${book.slug ?? book.id}`}
                  className={`cover-tilt relative block overflow-hidden rounded-xl ring-1 ring-white/20 shadow-lift ${
                    i === 1 ? "aspect-[3/4] w-40 -translate-y-6" : "aspect-[3/4] w-32"
                  }`}
                >
                  <Image
                    src={book.cover_image_url as string}
                    alt={book.title_bn}
                    fill
                    sizes="160px"
                    priority
                    className="object-cover"
                  />
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* ============================ বিভাগসমূহ ============================ */}
      {categories.length > 0 && (
        <Container className="py-12 sm:py-14">
          <SectionHeading
            eyebrow="বিভাগ"
            title="বিভাগ অনুযায়ী দেখুন"
            subtitle="আপনার পছন্দের ধরন বেছে নিন"
          />
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/books?category=${encodeURIComponent(c.slug)}`}
                className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-700 hover:bg-brand-50 hover:text-brand-900"
              >
                {c.icon && <span className="mr-1.5">{c.icon}</span>}
                {c.name_bn}
              </Link>
            ))}
          </div>
        </Container>
      )}

      {/* =========================== নির্বাচিত বই =========================== */}
      <Container className="pb-14">
        <SectionHeading
          title="নির্বাচিত বই"
          subtitle="আমাদের বাছাই করা সেরা বইগুলো"
          action={
            <Link href="/books" className={VIEW_ALL_CLASS}>
              সব দেখুন <span aria-hidden>→</span>
            </Link>
          }
        />

        {featured.length === 0 ? (
          <EmptyState
            title="এখনো কোনো বই যোগ করা হয়নি"
            description="অ্যাডমিন প্যানেল থেকে বই যোগ করলে এখানে দেখা যাবে।"
            action={
              <ButtonLink href="/admin/books" size="sm">
                বই যোগ করুন
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {featured.map((book, i) => (
              <BookCard key={book.id} book={book} priority={i < 4} />
            ))}
          </div>
        )}
      </Container>

      {/* ============================= প্রোমো কার্ড =============================
          দুটোই বাস্তব ডেটা থেকে — বানানো ছাড় বা কাল্পনিক অফার নয়। */}
      {(bestOffer || settings.free_delivery_note) && (
        <Container className="pb-14">
          <div className="grid gap-5 md:grid-cols-2">
            {bestOffer && (
              <div className="promo-warm relative overflow-hidden rounded-2xl p-7 text-white shadow-lift sm:p-8">
                <p className="text-xs font-medium text-white/80">সর্বোচ্চ ছাড়</p>
                <p className="font-display mt-2 text-5xl sm:text-6xl">
                  {toBanglaDigits(bestOffer.off)}%
                </p>
                <p className="prose-bn mt-3 line-clamp-2 max-w-xs text-sm text-white/85">
                  {bestOffer.book.title_bn}
                </p>
                <ButtonLink
                  href={`/books/${bestOffer.book.slug ?? bestOffer.book.id}`}
                  variant="outline"
                  size="sm"
                  className="mt-6 border-white/30 bg-white/10 text-white hover:border-white hover:bg-white hover:text-accent-800"
                >
                  এখনই দেখুন
                </ButtonLink>
              </div>
            )}

            {settings.free_delivery_note && (
              <div className="promo-cool relative overflow-hidden rounded-2xl p-7 text-white shadow-lift sm:p-8">
                <p className="text-xs font-medium text-white/80">ডেলিভারি</p>
                <p className="font-display prose-bn mt-2 text-3xl sm:text-4xl">
                  ফ্রি ডেলিভারি
                </p>
                <p className="prose-bn mt-3 max-w-xs text-sm text-white/85">
                  {settings.free_delivery_note}
                </p>
                <ButtonLink
                  href="/books"
                  variant="outline"
                  size="sm"
                  className="mt-6 border-white/30 bg-white/10 text-white hover:border-white hover:bg-white hover:text-brand-900"
                >
                  বই দেখুন
                </ButtonLink>
              </div>
            )}
          </div>
        </Container>
      )}

      {/* ============================ সদ্য এসেছে ============================ */}
      {newArrivals.length > 0 && (
        <Container className="pb-14">
          <SectionHeading
            title="সদ্য এসেছে"
            subtitle="সাম্প্রতিক যোগ করা বই"
            action={
              <Link href="/books?sort=new" className={VIEW_ALL_CLASS}>
                সব দেখুন <span aria-hidden>→</span>
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {newArrivals.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </Container>
      )}

      {/* ============================ কীভাবে পাবেন ============================
          তিন ধাপ — অর্ডার পেজে যা লেখা আছে, তারই সারসংক্ষেপ। */}
      <section className="border-y border-stone-200 bg-white">
        <Container className="py-14">
          <SectionHeading
            title="কীভাবে বই পাবেন"
            subtitle="তিন ধাপে ঘরে পৌঁছে যাবে"
            className="justify-center text-center [&>div]:mx-auto"
          />
          <ol className="grid gap-5 sm:grid-cols-3">
            {[
              {
                step: "০১",
                title: "বই বাছুন",
                body: "কার্টে যোগ করে চেকআউট করুন — অ্যাকাউন্ট খোলার দরকার নেই।",
              },
              {
                step: "০২",
                title: "আমরা ফোন দেব",
                body: "অর্ডার নিশ্চিত করতে আমরা কল দিয়ে কথা বলে নেব।",
              },
              {
                step: "০৩",
                title: "হাতে পেয়ে টাকা দিন",
                body: "কুরিয়ার বই পৌঁছে দিলে ক্যাশ অন ডেলিভারিতে টাকা পরিশোধ করবেন।",
              },
            ].map((s) => (
              <li
                key={s.step}
                className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-6"
              >
                <span className="font-display tabular text-2xl text-accent-600">{s.step}</span>
                <p className="font-display mt-3 text-lg text-stone-900">{s.title}</p>
                <p className="prose-bn mt-1.5 text-sm text-stone-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ============================== তথ্য ============================== */}
      <Container className="py-14">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: "💵", title: "হাতে পেয়ে টাকা দিন", body: "সারা দেশে ক্যাশ অন ডেলিভারি সুবিধা।" },
            { icon: "📱", title: "bKash / Nagad", body: "অগ্রিম পেমেন্টে দ্রুত ডেলিভারি।" },
            { icon: "↩️", title: "সহজ ফেরত", body: "বইয়ে সমস্যা থাকলে ৭ দিনের মধ্যে ফেরত।" },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-soft"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-xl" aria-hidden>
                {f.icon}
              </span>
              <p className="font-display mt-4 text-base text-stone-900">{f.title}</p>
              <p className="prose-bn mt-1 text-sm text-stone-600">{f.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
