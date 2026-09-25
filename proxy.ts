import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 এর Proxy ফাইল — প্রতিটি ম্যাচ করা রিকোয়েস্টে চলে।
 *
 * ⚠️ Next.js 16 এ আগের `middleware.ts` এর নাম এখন `proxy.ts`,
 *    আর ফাংশনের নাম `middleware` → `proxy`।
 *    (আপনি যদি Next.js 15 বা পুরনো ভার্সনে ফিরে যান, ফাইলের নাম
 *     `middleware.ts` এবং ফাংশনের নাম `middleware` করতে হবে।)
 *
 * এই ফাইলের কাজ: Supabase Auth সেশন টোকেন রিফ্রেশ করা।
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * নিচের পাথগুলো বাদে বাকি সব রিকোয়েস্টে চলে:
     *  - _next/static  (বিল্ড করা JS/CSS)
     *  - _next/image   (ইমেজ অপটিমাইজেশন)
     *  - favicon, robots.txt, sitemap.xml
     *  - যেকোনো স্ট্যাটিক ফাইল (ছবি, ফন্ট)
     *  - /api/*        (Route Handler — এগুলোর কোনো ইউজার সেশন লাগে না;
     *                   যেমন Cron এন্ডপয়েন্ট CRON_SECRET দিয়ে নিজেই সুরক্ষিত)
     *
     * এগুলো বাদ না দিলে Proxy অকারণে চলে সাইট স্লো করে দেবে।
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
