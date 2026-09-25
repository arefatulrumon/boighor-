import { createPublicClient } from "@/lib/supabase/public";
import { STORE_NAME } from "@/lib/supabase/env";

/**
 * `site_settings` টেবিল থেকে পাবলিক কনফিগ পড়ে টাইপড অবজেক্টে বদলায়।
 * ফলে কোডে `settings.bkash_number` লেখা যায় — string key নিয়ে ভাবতে হয় না।
 *
 * নতুন সেটিং যোগ করা:  supabase/migrations/0004_seed.sql এ key বসান,
 *                       এখানে টাইপে যোগ করুন, ব্যস।
 */
export interface StoreSettings {
  store_name: string;
  store_tagline: string;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  facebook_url: string;
  free_delivery_note: string;
  bkash_number: string;
  nagad_number: string;
  payment_instruction: string;
  hero_title: string;
  hero_subtitle: string;
  announcement: string;
  delivery_default_fee: number;
}

const DEFAULTS: StoreSettings = {
  store_name: STORE_NAME,
  store_tagline: "বাংলা বইয়ের বিশ্বস্ত ঠিকানা",
  contact_phone: "",
  contact_email: "",
  contact_address: "",
  facebook_url: "",
  free_delivery_note: "",
  bkash_number: "",
  nagad_number: "",
  payment_instruction: "",
  hero_title: "বাংলার সেরা বই, এক ক্লিকেই",
  hero_subtitle: "দেশজুড়ে ক্যাশ অন ডেলিভারি — বই হাতে পেয়ে টাকা দিন",
  announcement: "",
  delivery_default_fee: 120,
};

/** jsonb ভ্যালু থেকে স্ট্রিং বের করা (অ্যাডমিন প্যানেলে সব string হিসেবেই লেখা হয়) */
function asString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export async function getPublicSettings(): Promise<StoreSettings> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .eq("is_public", true);

  if (error || !data) {
    // সেটিংস পড়তে না পারলেও সাইট বন্ধ হবে না — ডিফল্ট দিয়ে চলবে।
    console.error("[getPublicSettings]", error?.message);
    return DEFAULTS;
  }

  const rows = data as unknown as Array<{ key: string; value: unknown }>;
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const out = { ...DEFAULTS };

  (Object.keys(DEFAULTS) as Array<keyof StoreSettings>).forEach((key) => {
    const raw = map.get(key);
    if (raw === undefined) return;

    if (key === "delivery_default_fee") {
      const n = Number(raw);
      if (Number.isFinite(n)) out.delivery_default_fee = n;
    } else {
      (out[key] as string) = asString(raw, DEFAULTS[key] as string);
    }
  });

  return out;
}
