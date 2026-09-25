import Image from "next/image";
import Link from "next/link";
import { StockAdjust, ToggleBookActive } from "@/components/admin/misc-forms";
import { Badge, ButtonLink, Card, cn } from "@/components/ui";
import { formatTaka, toBanglaDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Book } from "@/types/database";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; stock?: string; page?: string }>;

const PER_PAGE = 20;

export default async function AdminBooksPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const lowStockOnly = sp.stock === "low";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("books")
    .select(
      "id, slug, title_bn, author, cover_image_url, price, compare_at_price, stock_qty, low_stock_threshold, is_active, is_featured, category_id, language, binding, created_at, updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  if (q) {
    const safe = q.replace(/[%_,()\\]/g, " ").trim().slice(0, 60);
    if (safe) query = query.ilike("search_text", `%${safe.toLowerCase()}%`);
  }

  /*
   * "কম স্টক" ফিল্টার।
   *
   * PostgREST একটি কলামকে আরেকটি কলামের সাথে তুলনা করতে পারে না
   * (stock_qty <= low_stock_threshold)। তাই ছোট একটা কোয়েরি দিয়ে
   * আইডিগুলো বের করে তারপর মূল কোয়েরিতে `in` দেওয়া হয়।
   * বইয়ের সংখ্যা কয়েক হাজারের মধ্যে থাকলে এটাই সবচেয়ে সহজ সমাধান।
   */
  if (lowStockOnly) {
    const { data: candidates } = await supabase
      .from("books")
      .select("id, stock_qty, low_stock_threshold")
      .eq("is_active", true)
      .order("stock_qty", { ascending: true })
      .limit(1000);

    const ids = (candidates ?? [])
      .filter((b) => b.stock_qty <= b.low_stock_threshold)
      .map((b) => b.id as string);

    query = query.in(
      "id",
      ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  const { data, count, error } = await query;
  const books = (data ?? []) as unknown as Book[];

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">বই</h1>
          <p className="mt-1 text-sm text-stone-600">মোট {toBanglaDigits(count ?? 0)}টি বই</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action="/admin/books" method="get" className="flex gap-2">
            {lowStockOnly && <input type="hidden" name="stock" value="low" />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="বইয়ের নাম, লেখক..."
              className="w-52 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
            >
              খুঁজুন
            </button>
          </form>

          <Link
            href={lowStockOnly ? "/admin/books" : "/admin/books?stock=low"}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium",
              lowStockOnly
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            )}
          >
            ⚠️ কম স্টক
          </Link>

          <Link
            href="/admin/books/import"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            📄 CSV ইমপোর্ট
          </Link>

          <ButtonLink href="/admin/books/new">+ নতুন বই</ButtonLink>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          বই আনতে সমস্যা হয়েছে: {error.message}
        </p>
      )}

      {books.length === 0 ? (
        <Card>
          <p className="px-5 py-14 text-center text-sm text-stone-500">
            কোনো বই পাওয়া যায়নি।{" "}
            <Link href="/admin/books/new" className="font-medium text-emerald-800 hover:underline">
              প্রথম বই যোগ করুন
            </Link>
            ।
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">বই</th>
                  <th className="px-4 py-3">দাম</th>
                  <th className="px-4 py-3">স্টক</th>
                  <th className="px-4 py-3">অবস্থা</th>
                  <th className="px-4 py-3 text-right">কাজ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {books.map((b) => (
                  <tr key={b.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                          {b.cover_image_url ? (
                            <Image src={b.cover_image_url} alt={b.title_bn} fill sizes="48px" className="object-cover" />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-lg">📗</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-medium text-stone-900">{b.title_bn}</p>
                          <p className="line-clamp-1 text-xs text-stone-500">{b.author ?? "—"}</p>
                          {b.is_featured && (
                            <Badge className="mt-1 border-amber-200 bg-amber-50 text-amber-800">
                              নির্বাচিত
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="tabular px-4 py-3 font-medium">
                      {formatTaka(b.price, { symbol: true })}
                    </td>
                    <td className="px-4 py-3">
                      <StockAdjust bookId={b.id} stockQty={b.stock_qty} />
                    </td>
                    <td className="px-4 py-3">
                      <ToggleBookActive bookId={b.id} isActive={b.is_active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/books/${b.id}`}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-white"
                      >
                        সম্পাদনা
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* মোবাইল */}
          <ul className="divide-y divide-stone-100 lg:hidden">
            {books.map((b) => (
              <li key={b.id} className="p-4">
                <div className="flex gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                    {b.cover_image_url ? (
                      <Image src={b.cover_image_url} alt={b.title_bn} fill sizes="56px" className="object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-xl">📗</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-stone-900">{b.title_bn}</p>
                    <p className="text-xs text-stone-500">{b.author ?? "—"}</p>
                    <p className="tabular mt-1 text-sm font-semibold text-emerald-900">
                      {formatTaka(b.price, { symbol: true })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <StockAdjust bookId={b.id} stockQty={b.stock_qty} />
                  <div className="flex items-center gap-2">
                    <ToggleBookActive bookId={b.id} isActive={b.is_active} />
                    <Link
                      href={`/admin/books/${b.id}`}
                      className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium hover:bg-stone-50"
                    >
                      সম্পাদনা
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/books?${new URLSearchParams({ ...(q && { q }), ...(lowStockOnly && { stock: "low" }), page: String(page - 1) })}`}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-50"
            >
              ← আগের
            </Link>
          )}
          <span className="tabular px-3 text-sm text-stone-600">
            পেজ {toBanglaDigits(page)} / {toBanglaDigits(totalPages)}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/books?${new URLSearchParams({ ...(q && { q }), ...(lowStockOnly && { stock: "low" }), page: String(page + 1) })}`}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-50"
            >
              পরের →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
