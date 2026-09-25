"use server";

import { revalidatePath } from "next/cache";
import { FORBIDDEN, requireStaff } from "@/lib/actions/guard";
import type { AdminActionResult } from "@/types/database";

/**
 * সব অ্যাডমিন মিউটেশন এখানে।
 *
 * ⚠️ প্রতিটি ফাংশনের প্রথম কাজ `requireStaff()` — কারণ `proxy.ts` শুধু
 *    "লগইন করেছ?" দেখে, "staff কি?" দেখে না। বিস্তারিত: `guard.ts`
 */

/* ============================ অর্ডার ব্যবস্থাপনা ============================ */

export async function updateOrderStatus(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const orderId = String(formData.get("order_id") || "");
  const status = String(formData.get("status") || "");
  if (!orderId || !status) return { ok: false, code: "MISSING_INPUT" };

  const { data, error } = await guard.supabase.rpc("admin_set_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_note: (formData.get("note") as string) || null,
    p_courier: (formData.get("courier") as string) || null,
    p_tracking_code: (formData.get("tracking_code") as string) || null,
  });

  if (error) {
    console.error("[updateOrderStatus]", error.message);
    return { ok: false, code: "SERVER_ERROR" };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return data as AdminActionResult;
}

export async function updatePayment(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const orderId = String(formData.get("order_id") || "");
  const paymentStatus = String(formData.get("payment_status") || "");
  if (!orderId || !paymentStatus) return { ok: false, code: "MISSING_INPUT" };

  const amountRaw = String(formData.get("payment_amount_received") || "").trim();

  const { data, error } = await guard.supabase.rpc("admin_set_payment", {
    p_order_id: orderId,
    p_payment_status: paymentStatus,
    p_payment_ref: (formData.get("payment_ref") as string) || null,
    p_amount: amountRaw ? Number(amountRaw) : null,
  });

  if (error) {
    console.error("[updatePayment]", error.message);
    return { ok: false, code: "SERVER_ERROR" };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return data as AdminActionResult;
}

export async function saveAdminNote(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return { ok: false, code: "MISSING_INPUT" };

  const { error } = await guard.supabase
    .from("orders")
    .update({ admin_note: (formData.get("admin_note") as string) || null })
    .eq("id", orderId);

  if (error) return { ok: false, code: "SERVER_ERROR" };

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

/* ============================== বই ব্যবস্থাপনা ============================== */

/**
 * গ্যালারি আপলোডার একটি লুকানো input-এ JSON অ্যারে পাঠায়।
 * এখানে সেটা নিরাপদে পড়া হয় — ভাঙা JSON বা অচেনা URL বাদ পড়ে যায়।
 */
function readGallery(formData: FormData): string[] {
  const raw = String(formData.get("gallery_json") ?? "[]");
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
      .slice(0, 12);
  } catch {
    return [];
  }
}

/** ফর্ম থেকে বইয়ের ডেটা পড়া — নতুন ও সম্পাদনা দুটোতেই ব্যবহৃত হয়। */
function readBookForm(formData: FormData) {
  const num = (key: string): number | null => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const str = (key: string): string | null => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw || null;
  };

  return {
    title_bn: String(formData.get("title_bn") || "").trim(),
    title_en: str("title_en"),
    author: str("author"),
    translator: str("translator"),
    publisher: str("publisher"),
    isbn: str("isbn"),
    edition: str("edition"),
    language: String(formData.get("language") || "bangla"),
    binding: String(formData.get("binding") || "paperback"),
    pages: num("pages"),
    publication_year: num("publication_year"),
    description_bn: str("description_bn"),
    description_en: str("description_en"),
    cover_image_url: str("cover_image_url"),
    gallery: readGallery(formData),
    price: num("price") ?? 0,
    compare_at_price: num("compare_at_price"),
    cost_price: num("cost_price"),
    stock_qty: num("stock_qty") ?? 0,
    low_stock_threshold: num("low_stock_threshold") ?? 3,
    weight_grams: num("weight_grams"),
    category_id: str("category_id"),
    is_featured: formData.get("is_featured") === "on",
    is_active: formData.get("is_active") === "on",
    seo_title: str("seo_title"),
    seo_description: str("seo_description"),
  };
}

export async function createBook(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const payload = readBookForm(formData);
  if (payload.title_bn.length < 2) return { ok: false, code: "INVALID_TITLE" };
  if (payload.price < 0) return { ok: false, code: "INVALID_PRICE" };

  const { data, error } = await guard.supabase
    .from("books")
    .insert(payload)
    .select("id, slug")
    .single();

  if (error) {
    console.error("[createBook]", error.message);
    // 23505 = unique violation (একই slug/isbn আগেই আছে)
    return { ok: false, code: error.code === "23505" ? "DUPLICATE" : "SERVER_ERROR" };
  }

  revalidatePath("/admin/books");
  revalidatePath("/books");
  revalidatePath("/");
  return { ok: true, book: data };
}

export async function updateBook(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, code: "MISSING_INPUT" };

  const payload = readBookForm(formData);
  if (payload.title_bn.length < 2) return { ok: false, code: "INVALID_TITLE" };

  const { error } = await guard.supabase.from("books").update(payload).eq("id", id);

  if (error) {
    console.error("[updateBook]", error.message);
    return { ok: false, code: "SERVER_ERROR" };
  }

  revalidatePath("/admin/books");
  revalidatePath(`/admin/books/${id}`);
  revalidatePath("/books");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleBookActive(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const id = String(formData.get("id") || "");
  const next = formData.get("is_active") === "true";
  if (!id) return { ok: false, code: "MISSING_INPUT" };

  const { error } = await guard.supabase
    .from("books")
    .update({ is_active: next })
    .eq("id", id);

  if (error) return { ok: false, code: "SERVER_ERROR" };

  revalidatePath("/admin/books");
  revalidatePath("/books");
  return { ok: true, is_active: next };
}

export async function adjustStock(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const bookId = String(formData.get("book_id") || "");
  const delta = Number(formData.get("delta") || 0);
  if (!bookId || !Number.isFinite(delta) || delta === 0) {
    return { ok: false, code: "MISSING_INPUT" };
  }

  const { data, error } = await guard.supabase.rpc("admin_stock_adjust", {
    p_book_id: bookId,
    p_delta: Math.trunc(delta),
  });

  if (error) return { ok: false, code: "SERVER_ERROR" };

  revalidatePath("/admin/books");
  revalidatePath("/books");
  return data as AdminActionResult;
}

/* ============================== রিভিউ মডারেশন ============================== */

export async function setReviewApproval(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const id = String(formData.get("id") || "");
  const approved = formData.get("is_approved") === "true";
  if (!id) return { ok: false, code: "MISSING_INPUT" };

  const { error } = await guard.supabase
    .from("reviews")
    .update({ is_approved: approved })
    .eq("id", id);

  if (error) return { ok: false, code: "SERVER_ERROR" };

  revalidatePath("/admin/reviews");
  return { ok: true, is_approved: approved };
}

export async function deleteReview(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, code: "MISSING_INPUT" };

  const { error } = await guard.supabase.from("reviews").delete().eq("id", id);
  if (error) return { ok: false, code: "SERVER_ERROR" };

  revalidatePath("/admin/reviews");
  return { ok: true };
}

/* ============================== সেটিংস ============================== */

export async function updateSetting(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const key = String(formData.get("key") || "");
  const raw = String(formData.get("value") ?? "");

  if (!key) return { ok: false, code: "MISSING_INPUT" };

  // ইনপুট সবসময় টেক্সট আসে; সংখ্যা/বুলিয়ান হলে JSON টাইপ হিসেবেই সংরক্ষণ করি।
  let value: unknown = raw;
  const trimmed = raw.trim();
  if (trimmed === "true" || trimmed === "false") value = trimmed === "true";
  else if (trimmed !== "" && !Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    value = Number(trimmed);
  }

  const { error } = await guard.supabase
    .from("site_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) {
    console.error("[updateSetting]", error.message);
    return { ok: false, code: "SERVER_ERROR" };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true };
}
