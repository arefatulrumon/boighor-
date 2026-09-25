import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * কুকি-বিহীন পাবলিক ক্লায়েন্ট — শুধু ওয়েবসাইটের পাবলিক ডেটা পড়ার জন্য
 * (বইয়ের তালিকা, ক্যাটাগরি, সেটিংস, ডেলিভারি জোন)।
 *
 * কেন আলাদা ক্লায়েন্ট?
 *   ১) `server.ts` ক্লায়েন্ট `cookies()` পড়ে → Next.js ওই পেজকে "dynamic"
 *      বানিয়ে দেয়, অর্থাৎ প্রতিবার সার্ভার রেন্ডার হয় (স্লো ও খরচ বেশি)।
 *   ২) পাবলিক ডেটায় ইউজার সেশন লাগেই না। এই ক্লায়েন্ট cookie পড়ে না,
 *      তাই Next.js পেজগুলো ক্যাশ করে রাখতে পারে।
 *
 * ⚠️ শুধু পড়ার কাজে ব্যবহার করুন। অর্ডার/অ্যাডমিন — সবই `server.ts` দিয়ে।
 *    RLS প্রযোজ্য (anon ভূমিকা), তাই পাবলিক পলিসির বাইরে কিছু পড়া যাবে না।
 */
let cached: SupabaseClient<any, "public", any> | null = null;

export function createPublicClient(): SupabaseClient<any, "public", any> {
  if (!cached) {
    cached = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "boighor-public" } },
    });
  }
  return cached;
}
