"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { toBanglaDigits } from "@/lib/format";
import { cn } from "./ui";

const NAV = [
  { href: "/", label: "হোম" },
  { href: "/books", label: "সব বই" },
  { href: "/books?sort=new", label: "নতুন এসেছে" },
  { href: "/wishlist", label: "পরে কিনব" },
  { href: "/track", label: "অর্ডার ট্র্যাক" },
];

export function SiteHeader({ storeName }: { storeName: string }) {
  const { itemCount, ready } = useCart();
  const { count: wishlistCount, ready: wishlistReady } = useWishlist();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);

  // URL এ q বদলালে (যেমন ব্যাক বাটনে) ইনপুটও সিঙ্ক থাকবে
  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/books?q=${encodeURIComponent(q)}` : "/books");
    setMobileOpen(false);
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        {/* লোগো */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-800 text-lg text-white">
            📚
          </span>
          <span className="text-lg font-bold tracking-tight text-emerald-900">
            {storeName}
          </span>
        </Link>

        {/* সার্চ — মোবাইলে নিচে আলাদা লাইনে */}
        <form onSubmit={submitSearch} className="ml-auto hidden flex-1 max-w-md md:block" role="search">
          <label className="sr-only" htmlFor="site-search">
            বই খুঁজুন
          </label>
          <div className="relative">
            <input
              id="site-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="বই, লেখক বা প্রকাশনী খুঁজুন..."
              className="w-full rounded-full border border-stone-300 bg-stone-50 py-2 pl-10 pr-4 text-sm focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
              🔍
            </span>
          </div>
        </form>

        {/* ডেস্কটপ নেভ */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-emerald-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* উইশলিস্ট */}
        <Link
          href="/wishlist"
          className="relative ml-auto shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50 md:ml-0"
          aria-label="ইচ্ছেতালিকা"
        >
          ♡
          {wishlistReady && wishlistCount > 0 && (
            <span className="tabular absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-stone-700 px-1 text-[11px] font-bold text-white">
              {toBanglaDigits(wishlistCount)}
            </span>
          )}
        </Link>

        {/* কার্ট */}
        <Link
          href="/cart"
          className="relative shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50"
          aria-label="কার্ট"
        >
          🛒
          {ready && itemCount > 0 && (
            <span className="tabular absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
              {toBanglaDigits(itemCount)}
            </span>
          )}
        </Link>

        {/* মোবাইল মেনু বাটন */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm lg:hidden"
          aria-expanded={mobileOpen}
          aria-label="মেনু"
        >
          ☰
        </button>
      </div>

      {/* মোবাইল মেনু */}
      <div className={cn("border-t border-stone-200 lg:hidden", !mobileOpen && "hidden")}>
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-3">
          <form onSubmit={submitSearch} role="search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="বই, লেখক বা প্রকাশনী খুঁজুন..."
              className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm focus:border-emerald-700 focus:bg-white focus:outline-none"
            />
          </form>
          <nav className="grid gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
