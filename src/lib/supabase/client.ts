"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * ব্রাউজারের জন্য Supabase ক্লায়েন্ট।
 * শুধু Client Component এ ("use client") ব্যবহার করুন।
 *
 * সার্ভারে ডেটা লাগলে `lib/supabase/server.ts` ব্যবহার করুন —
 * সেটা কুকি থেকে সেশন পড়তে পারে, এটা পারে না।
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
