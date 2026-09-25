import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * ⚠️⚠️  SECRET KEY ক্লায়েন্ট — RLS সম্পূর্ণ বাইপাস করে  ⚠️⚠️
 *
 * ব্যবহারের নিয়ম (এটা না মানলে ভয়ংকর ভুল হবে):
 *   ✅ Supabase Storage এ ছবি আপলোড
 *   ✅ ক্রন/স্ক্রিপ্টে ব্যাচ কাজ
 *   ❌ ইউজারের রিকোয়েস্টে সরাসরি ডেটা পড়া/লেখা — সেটার জন্য `server.ts`
 *
 * `server-only` ইমপোর্ট নিশ্চিত করে এই ফাইলটা ভুলে কোনো Client Component
 * এ ইমপোর্ট করলে বিল্ড সময়েই এরর দেবে।
 *
 * SERVICE_ROLE_KEY পুরনো নাম — Supabase সেটা ২০২৬ সালের শেষে বন্ধ করছে।
 * নতুন নাম: SUPABASE_SECRET_KEY (sb_secret_...)
 */
export function createAdminClient() {
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY পাওয়া যায়নি। ছবি আপলোড করতে .env.local এ এটা বসান।"
    );
  }

  return createSupabaseClient(SUPABASE_URL, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** ছবি রাখার bucket এর নাম। Supabase Dashboard → Storage এ এটা বানাতে হবে। */
export const MEDIA_BUCKET = "book-covers";
