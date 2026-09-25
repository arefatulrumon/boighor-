import { createPublicClient } from "@/lib/supabase/public";
import { BOOKS_PER_PAGE } from "@/lib/constants";
import type { BookWithCategory, Category, DeliveryZone, Review } from "@/types/database";

/**
 * পাবলিক ডেটা পড়ার সব ফাংশন এক জায়গায়।
 * সবই createPublicClient() ব্যবহার করে (কুকি ছাড়া) — কারণ এগুলো
 * সবার জন্য একই ডেটা, ইউজার-নির্দিষ্ট নয়।
 *
 * RLS স্বয়ংক্রিয়ভাবে শুধু is_active = true বই/ক্যাটাগরি ফেরত দেয়।
 * তাই আলাদা `.eq('is_active', true)` দেওয়া হয়েছে — ইনডেক্স ব্যবহারের জন্য পরিষ্কার।
 */

const BOOK_LIST_COLUMNS =
  "id, slug, title_bn, title_en, author, translator, publisher, isbn, language, binding, pages, publication_year, description_bn, cover_image_url, gallery, price, compare_at_price, stock_qty, low_stock_threshold, category_id, is_featured, is_active, created_at, updated_at, category:categories(id, slug, name_bn, name_en)";

export type BookSort = "featured" | "new" | "price_asc" | "price_desc" | "title";

export interface BookQuery {
  q?: string;
  categorySlug?: string;
  sort?: BookSort;
  page?: number;
  perPage?: number;
}

/**
 * PostgREST এর ilike প্যাটার্নে ইউজারের লেখা থাকলে সেটা ওয়াইল্ডকার্ড হয়ে যায়।
 * `%` বা `_` দিয়ে ইউজার পুরো ডেটাবেস স্ক্যান করাতে পারে — তাই সরিয়ে দিই।
 */
function sanitizeSearch(input: string): string {
  return input.replace(/[%_,()\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function getBooks(params: BookQuery = {}) {
  const { q, categorySlug, sort = "featured", page = 1, perPage = BOOKS_PER_PAGE } = params;
  const supabase = createPublicClient();

  const from = (Math.max(1, page) - 1) * perPage;
  const to = from + perPage - 1;

  // ক্যাটাগরি দিয়ে ফিল্টার করতে inner join দরকার, নাহলে বই বাদ পড়বে না।
  const select = categorySlug
    ? BOOK_LIST_COLUMNS.replace("category:categories", "category:categories!inner")
    : BOOK_LIST_COLUMNS;

  let query = supabase
    .from("books")
    .select(select, { count: "exact" })
    .eq("is_active", true)
    .range(from, to);

  if (categorySlug) query = query.eq("category.slug", categorySlug);

  const term = q ? sanitizeSearch(q) : "";
  if (term) {
    // search_text আগেই lower() করা generated column, তাই ইনপুটও lowercase।
    query = query.ilike("search_text", `%${term.toLowerCase()}%`);
  }

  switch (sort) {
    case "new":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "title":
      query = query.order("title_bn", { ascending: true });
      break;
    default:
      query = query
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[getBooks]", error.message);
    return { books: [] as BookWithCategory[], total: 0, page, perPage };
  }

  return {
    books: (data ?? []) as unknown as BookWithCategory[],
    total: count ?? 0,
    page,
    perPage,
  };
}

export async function getFeaturedBooks(limit = 8): Promise<BookWithCategory[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("books")
    .select(BOOK_LIST_COLUMNS)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getFeaturedBooks]", error.message);
    return [];
  }
  return (data ?? []) as unknown as BookWithCategory[];
}

export async function getNewArrivals(limit = 8): Promise<BookWithCategory[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("books")
    .select(BOOK_LIST_COLUMNS)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as unknown as BookWithCategory[];
}

export async function getBookBySlug(slug: string): Promise<BookWithCategory | null> {
  const supabase = createPublicClient();

  // slug আগে, না পেলে id (slug ছাড়া পুরনো বইয়ের জন্য)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_LIST_COLUMNS)
    .eq(isUuid ? "id" : "slug", isUuid ? slug : decodeURIComponent(slug))
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[getBookBySlug]", error.message);
    return null;
  }
  return (data as unknown as BookWithCategory) ?? null;
}

export async function getRelatedBooks(
  bookId: string,
  categoryId: string | null,
  limit = 4
): Promise<BookWithCategory[]> {
  if (!categoryId) return [];
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_LIST_COLUMNS)
    .eq("is_active", true)
    .eq("category_id", categoryId)
    .neq("id", bookId)
    .limit(limit);

  if (error) return [];
  return (data ?? []) as unknown as BookWithCategory[];
}

export async function getCategories(): Promise<Category[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name_bn, name_en, parent_id, icon, sort_order, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getCategories]", error.message);
    return [];
  }
  return (data ?? []) as Category[];
}

export async function getApprovedReviews(bookId: string): Promise<Review[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("book_id", bookId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return [];
  return (data ?? []) as Review[];
}

/**
 * ডেলিভারি চার্জ ক্যালকুলেটর — চেকআউট পেজে লাইভ দেখানোর জন্য।
 * আসল চার্জ আবার create_order() এ হিসাব হয়; এটা শুধু প্রিভিউ।
 */
export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as DeliveryZone[];
}
