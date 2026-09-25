import { ReviewActions } from "@/components/admin/misc-forms";
import { Card, cn } from "@/components/ui";
import { formatDateTimeBn, toBanglaDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string }>;

/**
 * রিভিউ মডারেশন।
 *
 * RLS নীতি: যে কেউ রিভিউ লিখতে পারে, কিন্তু `is_approved = false` নিয়েই।
 * তাই স্প্যাম সরাসরি সাইটে যেতে পারে না — এখান থেকে অ্যাপ্রুভ করতে হয়।
 */
export default async function AdminReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = sp.tab === "approved" ? "approved" : "pending";

  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, author_name, rating, comment, is_approved, created_at, book:books(id, title_bn, slug)")
    .eq("is_approved", tab === "approved")
    .order("created_at", { ascending: false })
    .limit(100);

  const reviews = (data ?? []) as unknown as Array<{
    id: string;
    author_name: string;
    rating: number;
    comment: string | null;
    is_approved: boolean;
    created_at: string;
    book: { id: string; title_bn: string; slug: string | null } | null;
  }>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">রিভিউ</h1>
        <p className="mt-1 text-sm text-stone-600">
          অ্যাপ্রুভ করলে বইয়ের পেজে সবাই দেখতে পাবে।
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { value: "pending", label: "অপেক্ষায়" },
          { value: "approved", label: "অ্যাপ্রুভড" },
        ].map((t) => (
          <a
            key={t.value}
            href={`/admin/reviews?tab=${t.value}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium",
              tab === t.value
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            )}
          >
            {t.label}
          </a>
        ))}
      </div>

      {reviews.length === 0 ? (
        <Card>
          <p className="px-5 py-14 text-center text-sm text-stone-500">
            {tab === "pending" ? "নতুন কোনো রিভিউ নেই।" : "এখনো কোনো রিভিউ অ্যাপ্রুভ করা হয়নি।"}
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">
                    {r.author_name}
                    <span className="ml-2 text-amber-600">{"★".repeat(r.rating)}</span>
                    <span className="ml-1 text-xs font-normal text-stone-400">
                      {toBanglaDigits(r.rating)}/৫
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {r.book ? r.book.title_bn : "বই মুছে ফেলা হয়েছে"} ·{" "}
                    {formatDateTimeBn(r.created_at)}
                  </p>
                </div>
                <ReviewActions reviewId={r.id} isApproved={r.is_approved} />
              </div>

              {r.comment && (
                <p className="prose-bn mt-3 whitespace-pre-line text-sm text-stone-700">
                  {r.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
