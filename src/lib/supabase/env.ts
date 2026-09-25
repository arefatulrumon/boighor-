/**
 * এক জায়গা থেকেই env ভেরিয়েবল পড়া হয়, যাতে ভুল নাম লিখলে সাথে সাথে
 * স্পষ্ট এরর পাওয়া যায় (runtime এ চুপচাপ undefined হয়ে weird error না দেয়)।
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `পরিবেশ ভেরিয়েবল "${name}" পাওয়া যায়নি। .env.example কপি করে .env.local বানিয়ে মান বসান।`
    );
  }
  return value;
}

/** ব্রাউজারেও ব্যবহার হয় — publishable key গোপন নয়, RLS ই আসল নিরাপত্তা। */
export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

export const SUPABASE_PUBLISHABLE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || "বইঘর";
