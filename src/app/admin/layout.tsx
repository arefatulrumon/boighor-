import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const metadata = {
  title: "অ্যাডমিন প্যানেল",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "ড্যাশবোর্ড", icon: "📊" },
  { href: "/admin/orders", label: "অর্ডার", icon: "📦" },
  { href: "/admin/books", label: "বই", icon: "📚" },
  { href: "/admin/reviews", label: "রিভিউ", icon: "⭐" },
  { href: "/admin/settings", label: "সেটিংস", icon: "⚙️" },
];

/**
 * অ্যাডমিন এলাকার দ্বিতীয় স্তরের সুরক্ষা।
 *
 *   স্তর ১: proxy.ts        → লগইন আছে কি না (দ্রুত নক-ব্যাক)
 *   স্তর ২: এই layout       → staff কি না (এখানে)
 *   স্তর ৩: RLS + RPC       → আসল রক্ষাকবচ, ডেটাবেসেই
 *
 * যেকোনো একটি বাদ পড়লেও ডেটা নিরাপদ থাকে — কারণ DB নিজেই যাচাই করে।
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/admin");

  const supabase = await createClient();
  const { data: isStaff } = await supabase.rpc("is_staff");

  if (!isStaff) redirect("/login?error=not_staff");

  const { data: staffRow } = await supabase
    .from("staff")
    .select("full_name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
      {/* ------------------------------ সাইডবার ------------------------------ */}
      <aside className="lg:w-56 lg:shrink-0">
        <div className="rounded-xl border border-stone-200 bg-white p-4 lg:sticky lg:top-24">
          <div className="mb-4 border-b border-stone-100 pb-4">
            <p className="text-xs uppercase tracking-wide text-stone-400">অ্যাডমিন</p>
            <p className="mt-1 truncate text-sm font-semibold text-stone-900">
              {staffRow?.full_name || user.email}
            </p>
            <p className="text-xs text-stone-500">{staffRow?.role ?? "staff"}</p>
          </div>

          <nav className="space-y-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-emerald-900"
              >
                <span aria-hidden>{n.icon}</span>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 space-y-1 border-t border-stone-100 pt-4">
            <Link
              href="/"
              className="block rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
            >
              ↗ ওয়েবসাইট দেখুন
            </Link>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* -------------------------------- কনটেন্ট -------------------------------- */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
