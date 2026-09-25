import Link from "next/link";
import { OrdersExport } from "@/components/admin/orders-export";
import { Badge, Card, cn } from "@/components/ui";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL_BN,
  PAYMENT_METHOD_LABEL_BN,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL_BN,
} from "@/lib/constants";
import { formatDateTimeBn, formatTaka, toBanglaDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  payment?: string;
  q?: string;
  page?: string;
}>;

const PER_PAGE = 25;

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "", label: "সব" },
  { value: "pending", label: "নতুন" },
  { value: "confirmed", label: "নিশ্চিত" },
  { value: "packed", label: "প্যাক" },
  { value: "shipped", label: "পাঠানো" },
  { value: "delivered", label: "ডেলিভারড" },
  { value: "cancelled", label: "বাতিল" },
];

function buildUrl(current: Record<string, string | undefined>, overrides: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  Object.entries(merged).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const payment = sp.payment ?? "";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, address_line, area, division, district, postcode, delivery_note, total, status, payment_method, payment_status, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_status", payment);

  if (q) {
    // অর্ডার নম্বর বা ফোন — দুটোই দিয়ে খোঁজা যায়
    const safe = q.replace(/[%_,()\\]/g, " ").trim().slice(0, 40);
    if (safe) query = query.or(`order_number.ilike.%${safe}%,customer_phone.ilike.%${safe}%`);
  }

  const { data, count, error } = await query;

  type ListedOrder = Pick<
    Order,
    | "id" | "order_number" | "customer_name" | "customer_phone" | "address_line"
    | "area" | "division" | "district" | "postcode" | "delivery_note"
    | "total" | "status" | "payment_method" | "payment_status" | "created_at"
  >;
  const orders = (data ?? []) as unknown as ListedOrder[];

  // কুরিয়ারের পোর্টালে পেস্ট করার জন্য — শুধু যেগুলো এখনো পাঠানো হয়নি
  const exportable = orders
    .filter((o) => o.status === "confirmed" || o.status === "packed" || o.status === "pending")
    .map((o) => ({
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      address_line: o.address_line,
      area: o.area,
      district: o.district,
      division: o.division,
      postcode: o.postcode,
      total: Number(o.total),
      payment_method: o.payment_method,
      delivery_note: o.delivery_note,
    }));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const current = { status, payment, q, page: String(page) };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">অর্ডার</h1>
          <p className="mt-1 text-sm text-stone-600">
            মোট {toBanglaDigits(count ?? 0)}টি অর্ডার
          </p>
        </div>

        {/* অনুসন্ধান */}
        <form action="/admin/orders" method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="অর্ডার নম্বর বা ফোন..."
            className="w-56 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
          >
            খুঁজুন
          </button>
        </form>

        <OrdersExport orders={exportable} />
      </div>

      {/* স্টেটাস ট্যাব */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value || "all"}
            href={buildUrl({ payment, q }, { status: t.value, page: 1 })}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium",
              status === t.value
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          অর্ডার আনতে সমস্যা হয়েছে: {error.message}
        </p>
      )}

      {orders.length === 0 ? (
        <Card>
          <p className="px-5 py-14 text-center text-sm text-stone-500">
            এই ফিল্টারে কোনো অর্ডার নেই।
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* ডেস্কটপ টেবিল */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">অর্ডার</th>
                  <th className="px-4 py-3">কাস্টমার</th>
                  <th className="px-4 py-3">এলাকা</th>
                  <th className="px-4 py-3">পেমেন্ট</th>
                  <th className="px-4 py-3">স্টেটাস</th>
                  <th className="px-4 py-3 text-right">মোট</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <span className="tabular font-semibold text-emerald-900">{o.order_number}</span>
                      <span className="mt-0.5 block text-xs text-stone-400">
                        {formatDateTimeBn(o.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-900">{o.customer_name}</span>
                      <span className="tabular mt-0.5 block text-xs text-stone-500">
                        {o.customer_phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {o.district}
                      <span className="block text-xs text-stone-400">{o.division}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={PAYMENT_STATUS_COLOR[o.payment_status]}>
                        {PAYMENT_STATUS_LABEL_BN[o.payment_status]}
                      </Badge>
                      <span className="mt-1 block text-xs text-stone-500">
                        {PAYMENT_METHOD_LABEL_BN[o.payment_method]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={ORDER_STATUS_COLOR[o.status]}>
                        {ORDER_STATUS_LABEL_BN[o.status]}
                      </Badge>
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold text-stone-900">
                      {formatTaka(o.total, { symbol: true })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-white"
                      >
                        খুলুন
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* মোবাইল কার্ড */}
          <ul className="divide-y divide-stone-100 lg:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="block p-4 hover:bg-stone-50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="tabular text-sm font-semibold text-emerald-900">
                      {o.order_number}
                    </span>
                    <Badge className={ORDER_STATUS_COLOR[o.status]}>
                      {ORDER_STATUS_LABEL_BN[o.status]}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-stone-800">{o.customer_name}</p>
                  <p className="tabular text-xs text-stone-500">{o.customer_phone}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-stone-500">
                      {o.district}, {o.division}
                    </span>
                    <span className="tabular text-sm font-semibold text-stone-900">
                      {formatTaka(o.total, { symbol: true })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildUrl(current, { page: page - 1 })}
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
              href={buildUrl(current, { page: page + 1 })}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-50"
            >
              পরের →
            </Link>
          )}
        </nav>
      )}

      {/* স্টেটাস ফিল্টার রিসেট হেল্পার */}
      {(status || payment || q) && (
        <p className="text-center text-sm">
          <Link href="/admin/orders" className="text-emerald-800 hover:underline">
            ফিল্টার মুছে ফেলুন
          </Link>
        </p>
      )}

      <p className="text-xs text-stone-400">
        টিপস:{" "}
        {(["pending", "confirmed", "packed", "shipped", "delivered"] as OrderStatus[]).join(" → ")}{" "}
        — এই ক্রমে অর্ডার এগোয়।
      </p>
    </div>
  );
}
