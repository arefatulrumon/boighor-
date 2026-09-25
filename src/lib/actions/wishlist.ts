"use server";

import { createPublicClient } from "@/lib/supabase/public";
import type { BookWithCategory } from "@/types/database";

/**
 * উইশলিস্ট ডেটাবেসে থাকে না (ক্রেতার অ্যাকাউন্টই নেই) — শুধু book_id গুলো
 * ব্রাউজারে জমা থাকে। বইয়ের আসল তথ্য আনতে হয় সার্ভার থেকে।
 *
 * এখানে `createPublicClient` ব্যবহার করা হয় কারণ এটি কোনো ইউজার-সpecific
 * ডেটা নয় — যে কেউ এই বইগুলো দেখতে পারে। RLS নিজেই শুধু `is_active` বই
 * ফেরত দেয়, তাই মুছে ফেলা/বন্ধ করা বই স্বয়ংক্রিয়ভাবে তালিকা থেকে ঝরে পড়ে।
 */
export async function getBooksByIds(ids: string[]): Promise<BookWithCategory[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  // UUID নয় এমন কিছু পাঠানো হলে কুয়েরি ব্যর্থ হয় — আগেই ছেঁকে নেওয়া
  const safe = ids
    .filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 100);

  if (safe.length === 0) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("books")
    .select("*, category:categories(id, slug, name_bn, name_en)")
    .in("id", safe)
    .eq("is_active", true);

  if (error) {
    console.error("[getBooksByIds]", error.message);
    return [];
  }

  const books = (data ?? []) as unknown as BookWithCategory[];

  // ব্যবহারকারী যে ক্রমে যোগ করেছিলেন সেভাবে সাজানো (ডেটাবেসের ক্রম নয়)
  const order = new Map(safe.map((id, i) => [id, i]));
  return books.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
