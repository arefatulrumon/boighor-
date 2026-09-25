import { SettingsForm, type SettingRow } from "@/components/admin/misc-forms";
import { Card, CardHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * সাইট সেটিংস — `site_settings` টেবিলের key/value জোড়া (jsonb)।
 *
 * নতুন সেটিং যোগ করতে:
 *   ১) SQL: insert into public.site_settings (key, value, is_public, label_bn) values (...)
 *   ২) `src/lib/settings.ts` এর StoreSettings ইন্টারফেসে key যোগ করুন
 *   ৩) ওয়েবসাইটে ব্যবহার করুন — settings.your_new_key
 * এখানে কোনো কোড বদলাতে হবে না, ফর্ম নিজেই নতুন key দেখাবে।
 */
export default async function AdminSettingsPage() {
  const supabase = await createClient();

  // RLS: staff সব সেটিং দেখতে পারে (is_public যাই হোক)
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value, label_bn, is_public")
    .order("is_public", { ascending: false })
    .order("key");

  const settings = (data ?? []) as SettingRow[];

  const publicSettings = settings.filter((s) => s.is_public);
  const privateSettings = settings.filter((s) => !s.is_public);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">সেটিংস</h1>
        <p className="mt-1 text-sm text-stone-600">
          দোকানের তথ্য, পেমেন্ট নম্বর আর হোমপেজের লেখা এখান থেকে বদলান।
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          সেটিংস আনতে সমস্যা হয়েছে: {error.message}
        </p>
      )}

      <Card>
        <CardHeader title="আপনার সব সেটিংস" />
        <div className="px-5 py-4">
          {settings.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">
              কোনো সেটিং পাওয়া যায়নি। `supabase/migrations/0004_seed.sql` চালান।
            </p>
          ) : (
            <SettingsForm settings={[...publicSettings, ...privateSettings]} />
          )}
        </div>
      </Card>

      <p className="text-xs text-stone-500">
        💡 &quot;ঘোষণা বার&quot; খালি রাখলে ওয়েবসাইটে দেখাবে না। &quot;অর্ডার বন্ধ&quot; true করলে
        (এখনো চেকআউটে যুক্ত করা হয়নি) — ভবিষ্যতে ব্যবহৃত হবে।
      </p>
    </div>
  );
}
