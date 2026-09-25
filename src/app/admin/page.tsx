import Link from "next/link";
import { Badge, Card, CardHeader } from "@/components/ui";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL_BN,
  PAYMENT_STATUS_LABEL_BN,
} from "@/lib/constants";
import { formatDateTimeBn, formatTaka, toBanglaDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";

export const dynamic = "force-dynamic"; // ড্যাশবোর্ড সবসময় তাজা ডেটা দেখাবে

export default async function AdminDashboard() {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // সব কাউন্ট একসাথে (head: true মানে ডেটা নামায় না, শুধু সংখ্যা আনে)
  const [pending, paidPending, todayOrders, lowStock, totalBooks, recentRes] =
    await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "pending_verification"),
      supabase
        .from("orders")
        .select("id, total, status")
        .gte("created_at", startOfToday.toISOString()),
      supabase
        .from("books")
        .select("id, title_bn, stock_qty, low_stock_threshold")
        .eq("is_active", true)
        .order("stock_qty", { ascending: true })
        .limit(50),
      supabase.from("books").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_phone, total, status, payment_status, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const todayList = (todayOrders.data ?? []) as Array<{
    id: string;
    total: number;
    status: string;
  }>;

  const todayCount = todayList.length;
  const todayRevenue = todayList
    .filter((o) => o.status !== "cancelled" && o.status !== "returned")
    .reduce((sum, o) => sum + Number(o.total), 0);

  const lowStockBooks = (lowStock.data ?? []).filter(
    (b) => b.stock_qty <= b.low_stock_threshold
  );

  type RecentOrder = Pick<
    Order,
    "id" | "order_number" | "customer_name" | "customer_phone" | "total" | "status" | "payment_status" | "created_at"
  >;
  const recent = (recentRes.data ?? []) as RecentOrder[];

  const stats = [
    { label: "নতুন অর্ডার", value: toBanglaDigits(pending.count ?? 0), icon: "🔔", href: "/admin/orders?status=pending", tone: "amber" },
    { label: "আজকের অর্ডার", value: toBanglaDigits(todayCount), icon: "📅", href: "/admin/orders", tone: "sky" },
    { label: "আজকের বিক্রি", value: formatTaka(todayRevenue, { symbol: true }), icon: "💰", href: "/admin/orders", tone: "emerald" },
    { label: "পেমেন্ট যাচাই বাকি", value: toBanglaDigits(paidPending.count ?? 0), icon: "🧾", href: "/admin/orders?payment=pending_verification", tone: "violet" },
    { label: "স্টক কম", value: toBanglaDigits(lowStockBooks.length), icon: "⚠️", href: "/admin/books?stock=low", tone: "rose" },
    { label: "সক্রিয় বই", value: toBanglaDigits(totalBooks.count ?? 0), icon: "📚", href: "/admin/books", tone: "stone" },
  ] as const;

  const toneClass: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50",
    sky: "border-sky-200 bg-sky-50",
    emerald: "border-emerald-200 bg-emerald-50",
    violet: "border-violet-200 bg-violet-50",
    rose: "border-rose-200 bg-rose-50",
    stone: "border-stone-200 bg-stone-50",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">ড্যাশবোর্ড</h1>
        <p className="mt-1 text-sm text-stone-600">দোকানের সারসংক্ষেপ এক নজরে</p>
      </div>

      {/* -------------------------------- স্ট্যাট -------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${toneClass[s.tone]}`}
          >
            <p className="text-lg" aria-hidden>{s.icon}</p>
            <p className="tabular mt-2 text-2xl font-bold text-stone-900">{s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-stone-600">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* ----------------------------- নতুন অর্ডার ----------------------------- */}
      <Card>
        <CardHeader
          title="সাম্প্রতিক অর্ডার"
          action={
            <Link href="/admin/orders" className="text-sm font-medium text-emerald-800 hover:underline">
              সব দেখুন →
            </Link>
          }
        />

        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-500">
            এখনো কোনো অর্ডার আসেনি।
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recent.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 hover:bg-stone-50"
                >
                  <span className="tabular text-sm font-semibold text-emerald-900">
                    {o.order_number}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-stone-800">
                    {o.customer_name}
                    <span className="tabular ml-2 text-xs text-stone-500">{o.customer_phone}</span>
                  </span>
                  <Badge className={ORDER_STATUS_COLOR[o.status]}>
                    {ORDER_STATUS_LABEL_BN[o.status]}
                  </Badge>
                  <span className="text-xs text-stone-500">
                    {PAYMENT_STATUS_LABEL_BN[o.payment_status]}
                  </span>
                  <span className="tabular text-sm font-semibold text-stone-900">
                    {formatTaka(o.total, { symbol: true })}
                  </span>
                  <span className="w-full text-xs text-stone-400 sm:w-auto">
                    {formatDateTimeBn(o.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ------------------------------- স্টক কম ------------------------------- */}
      {lowStockBooks.length > 0 && (
        <Card>
          <CardHeader
            title={`স্টক কম (${toBanglaDigits(lowStockBooks.length)}টি বই)`}
            action={
              <Link href="/admin/books" className="text-sm font-medium text-emerald-800 hover:underline">
                ম্যানেজ করুন →
              </Link>
            }
          />
          <ul className="divide-y divide-stone-100">
            {lowStockBooks.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="line-clamp-1 text-stone-800">{b.title_bn}</span>
                <Badge
                  className={
                    b.stock_qty === 0
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }
                >
                  {b.stock_qty === 0 ? "স্টক শেষ" : `${toBanglaDigits(b.stock_qty)} কপি`}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
