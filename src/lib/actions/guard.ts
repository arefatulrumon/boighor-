import "server-only";

import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * প্রতিটি অ্যাডমিন Server Action এর প্রথম লাইন।
 *
 * ⚠️ কেন এটা বাধ্যতামূলক?
 *    `proxy.ts` শুধু দেখে "লগইন করা আছে?"। "staff কি?" দেখে না।
 *    আর Server Action গুলোর নিজস্ব URL থাকে, তাই কেউ সরাসরি POST করলে
 *    proxy এর রুট-ম্যাচিং কাজ নাও করতে পারে।
 *
 *    আসল রক্ষাকবচ RLS, কিন্তু সেটা ছাড়া এরর মেসেজ অস্পষ্ট হয় —
 *    আর সবচেয়ে বিপজ্জনক দিকটা হলো: ভবিষ্যতে কেউ RLS পলিসি ঢিলে করলে
 *    এই চেকটাই শেষ প্রাচীর।
 *
 * ব্যবহার:
 *   const guard = await requireStaff();
 *   if (!guard.ok) return { ok: false, code: "FORBIDDEN" };
 *   // ... তারপর guard.supabase দিয়ে কাজ করুন (RLS প্রযোজ্য)
 */
export type StaffGuard =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; error: null }
  | { ok: false; supabase: null; userId: null; error: string };

export async function requireStaff(): Promise<StaffGuard> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, supabase: null, userId: null, error: "লগইন করা নেই।" };
  }

  const supabase = await createClient();
  const { data: isStaff } = await supabase.rpc("is_staff");

  if (!isStaff) {
    return {
      ok: false,
      supabase: null,
      userId: null,
      error: "আপনার এই কাজের অনুমতি নেই।",
    };
  }

  return { ok: true, supabase, userId: user.id, error: null };
}

/** সব অ্যাডমিন অ্যাকশনের সাধারণ ব্যর্থ উত্ত */
export const FORBIDDEN = { ok: false as const, code: "FORBIDDEN" as const };
