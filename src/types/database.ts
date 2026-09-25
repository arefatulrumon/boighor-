/**
 * ডেটাবেসের সারির (row) টাইপ ডেফিনিশন।
 *
 * এগুলো হাতে লেখা, যাতে প্রজেক্ট ক্লোন করে `npm install` করলেই টাইপ পাওয়া যায়
 * (Supabase প্রজেক্টে লিংক করা ছাড়াই)।
 *
 * ⚠️ স্কিমা বদলালে এই ফাইলটাও বদলাতে হবে। অথবা অটো-জেনারেট করতে পারেন:
 *      npm run db:types
 *    (এর জন্য `supabase` CLI আর প্রজেক্ট লিংক লাগে — README দেখুন)
 *
 * 💡 নামকরণ নিয়ম: ডেটাবেস snake_case, আর কম্পোনেন্টে সরাসরি ওটাই ব্যবহার করা হয়
 *    (দুই জায়গায় দুই নাম রাখলে ভুল বাড়ে)।
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ------------------------------- enum গুলো ------------------------------- */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentMethod = "cod" | "bkash" | "nagad";

export type PaymentStatus =
  | "unpaid"
  | "pending_verification"
  | "paid"
  | "refunded"
  | "failed";

export type BookLanguage = "bangla" | "english" | "arabic" | "hindi" | "other";

export type BookBinding = "paperback" | "hardcover" | "spiral" | "ebook";

export type DiscountType = "percent" | "fixed";

export type StaffRole = "admin" | "manager" | "fulfillment";

/* --------------------------------- টেবিল -------------------------------- */

export interface Staff {
  user_id: string;
  full_name: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string | null;
  parent_id: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  slug: string | null;

  title_bn: string;
  title_en: string | null;
  author: string | null;
  translator: string | null;
  publisher: string | null;
  isbn: string | null;
  edition: string | null;

  language: BookLanguage;
  binding: BookBinding;
  pages: number | null;
  publication_year: number | null;

  description_bn: string | null;
  description_en: string | null;

  cover_image_url: string | null;
  gallery: string[];

  price: number;
  compare_at_price: number | null;
  cost_price: number | null;

  stock_qty: number;
  low_stock_threshold: number;
  weight_grams: number | null;

  category_id: string | null;
  is_featured: boolean;
  is_active: boolean;

  seo_title: string | null;
  seo_description: string | null;

  created_at: string;
  updated_at: string;
}

/** বইয়ের সাথে join করা ক্যাটাগরি — `select('*, category:categories(...)')` */
export interface BookWithCategory extends Book {
  category: Pick<Category, "id" | "slug" | "name_bn" | "name_en"> | null;
}

export interface DeliveryZone {
  id: string;
  name_bn: string;
  division: string;
  fee: number;
  free_above: number | null;
  cod_available: boolean;
  eta_days_min: number;
  eta_days_max: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description_bn: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  per_phone_limit: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;

  customer_name: string;
  customer_phone: string;
  customer_email: string | null;

  division: string;
  district: string;
  area: string | null;
  address_line: string;
  postcode: string | null;
  delivery_note: string | null;

  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  coupon_code: string | null;

  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_ref: string | null;
  payment_sender_phone: string | null;
  payment_amount_received: number | null;

  status: OrderStatus;
  courier: string | null;
  /** কুরিয়ারের নিজের আইডি — স্টেটাস জানতে এটা লাগে (migration 0007) */
  courier_consignment_id: string | null;
  /** সর্বশেষ কুরিয়ার স্টেটাস সিঙ্কের সময় */
  courier_synced_at: string | null;
  tracking_code: string | null;
  admin_note: string | null;
  cancel_reason: string | null;

  ip_hash: string | null;

  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  book_id: string | null;
  title_snapshot: string;
  author_snapshot: string | null;
  cover_snapshot: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  book_id: string;
  author_name: string;
  author_phone: string | null;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface SiteSetting {
  key: string;
  value: Json;
  is_public: boolean;
  label_bn: string | null;
  updated_at: string;
}

/* ---------------------------- RPC এর রিটার্ন টাইপ ---------------------------- */

/** create_order() এর রিটার্ন */
export type CreateOrderResult =
  | {
      ok: true;
      order_id: string;
      order_number: string;
      subtotal: number;
      discount: number;
      delivery_fee: number;
      total: number;
    }
  | { ok: false; code: string; message: string };

/** validate_coupon() এর রিটার্ন */
export type CouponCheckResult =
  | { valid: false; reason: string; min_order?: number }
  | { valid: true; code: string; discount: number; description_bn: string | null };

/** track_order() এর রিটার্ন */
export type TrackOrderResult =
  | {
      ok: true;
      order_number: string;
      status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      subtotal: number;
      discount: number;
      delivery_fee: number;
      total: number;
      courier: string | null;
      tracking_code: string | null;
      created_at: string;
      shipped_at: string | null;
      delivered_at: string | null;
      items: Array<{
        title: string;
        cover: string | null;
        unit_price: number;
        quantity: number;
        line_total: number;
      }>;
    }
  | { ok: false; code: string; message?: string };

/** admin_set_order_status() / admin_set_payment() এর রিটার্ন */
export type AdminActionResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; code: string };
