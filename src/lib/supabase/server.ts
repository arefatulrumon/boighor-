import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * সার্ভারের জন্য Supabase ক্লায়েন্ট — Server Component, Server Action
 * আর Route Handler এ ব্যবহার করুন।
 *
 * ⚠️ Next.js 16 এ `cookies()` async — তাই এই ফাংশনটাও async।
 *    ব্যবহার:  const supabase = await createClient()
 *
 * এই ক্লায়েন্ট publishable key দিয়ে চলে, অর্থাৎ RLS প্রযোজ্য।
 * ইউজার লগইন থাকলে auth.uid() ভরে যায়, ফলে staff পলিসি কাজ করে।
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component থেকে কুকি সেট করা যায় না।
          // এটা স্বাভাবিক — টোকেন রিফ্রেশের কাজটা `proxy.ts` করে দেয়।
        }
      },
    },
  });
}

/**
 * লগইন করা ইউজার (থাকলে) — সার্ভার-ভেরিফায়েড।
 * getClaims() ব্যবহার করা হয় কারণ এটা টোকেনের সিগনেচার যাচাই করে;
 * getSession() শুধু কুকি পড়ে, তাই সার্ভারে সেটা বিশ্বাস করা যায় না।
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  return {
    id: data.claims.sub as string,
    email: (data.claims.email as string | undefined) ?? null,
  };
}
