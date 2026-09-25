import type {
  BookBinding,
  BookLanguage,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/database";

/* ============================ বাংলাদেশের বিভাগ/জেলা ============================ */

export const DIVISIONS = [
  "ঢাকা",
  "চট্টগ্রাম",
  "রাজশাহী",
  "খুলনা",
  "বরিশাল",
  "সিলেট",
  "রংপুর",
  "ময়মনসিংহ",
] as const;

export type Division = (typeof DIVISIONS)[number];

/** ৬৪ জেলা, বিভাগ অনুযায়ী সাজানো। ডেলিভারি ফি বিভাগ দিয়ে ঠিক হয়। */
export const DISTRICTS_BY_DIVISION: Record<Division, string[]> = {
  ঢাকা: [
    "ঢাকা", "গাজীপুর", "নারায়ণগঞ্জ", "নরসিংদী", "মুন্সিগঞ্জ",
    "মানিকগঞ্জ", "টাঙ্গাইল", "কিশোরগঞ্জ", "ফরিদপুর", "গোপালগঞ্জ",
    "মাদারীপুর", "রাজবাড়ী", "শরীয়তপুর",
  ],
  চট্টগ্রাম: [
    "চট্টগ্রাম", "কক্সবাজার", "কুমিল্লা", "ব্রাহ্মণবাড়িয়া", "চাঁদপুর",
    "ফেনী", "লক্ষ্মীপুর", "নোয়াখালী", "বান্দরবান", "রাঙ্গামাটি", "খাগড়াছড়ি",
  ],
  রাজশাহী: [
    "রাজশাহী", "নাটোর", "নওগাঁ", "চাঁপাইনবাবগঞ্জ",
    "পাবনা", "সিরাজগঞ্জ", "বগুড়া", "জয়পুরহাট",
  ],
  খুলনা: [
    "খুলনা", "বাগেরহাট", "সাতক্ষীরা", "যশোর", "ঝিনাইদহ",
    "মাগুরা", "নড়াইল", "কুষ্টিয়া", "চুয়াডাঙ্গা", "মেহেরপুর",
  ],
  বরিশাল: ["বরিশাল", "পটুয়াখালী", "ভোলা", "পিরোজপুর", "বরগুনা", "ঝালকাঠি"],
  সিলেট: ["সিলেট", "মৌলভীবাজার", "হবিগঞ্জ", "সুনামগঞ্জ"],
  রংপুর: [
    "রংপুর", "দিনাজপুর", "ঠাকুরগাঁও", "পঞ্চগড়",
    "নীলফামারী", "লালমনিরহাট", "কুড়িগ্রাম", "গাইবান্ধা",
  ],
  ময়মনসিংহ: ["ময়মনসিংহ", "জামালপুর", "নেত্রকোণা", "শেরপুর"],
};

/* ================================ লেবেল ================================ */

export const ORDER_STATUS_LABEL_BN: Record<OrderStatus, string> = {
  pending: "নতুন অর্ডার",
  confirmed: "নিশ্চিত হয়েছে",
  packed: "প্যাক হয়েছে",
  shipped: "কুরিয়ারে দেওয়া হয়েছে",
  delivered: "ডেলিভারি সম্পন্ন",
  cancelled: "বাতিল",
  returned: "ফেরত এসেছে",
};

/** অর্ডার স্টেটাসের রঙ (Tailwind ক্লাস) — ব্যাজে ব্যবহার হয়। */
export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-sky-100 text-sky-800 border-sky-200",
  packed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  shipped: "bg-violet-100 text-violet-800 border-violet-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  returned: "bg-stone-100 text-stone-800 border-stone-200",
};

/** অর্ডার যেভাবে এগোবে — অ্যাডমিন প্যানেলে পরের ধাপ সাজেস্ট করতে কাজে লাগে। */
export const ORDER_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];

export const PAYMENT_METHOD_LABEL_BN: Record<PaymentMethod, string> = {
  cod: "ক্যাশ অন ডেলিভারি",
  bkash: "bKash (অগ্রিম)",
  nagad: "Nagad (অগ্রিম)",
};

export const PAYMENT_STATUS_LABEL_BN: Record<PaymentStatus, string> = {
  unpaid: "টাকা হয়নি",
  pending_verification: "যাচাই বাকি",
  paid: "পরিশোধিত",
  refunded: "ফেরত দেওয়া হয়েছে",
  failed: "ব্যর্থ",
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  unpaid: "bg-stone-100 text-stone-700 border-stone-200",
  pending_verification: "bg-amber-100 text-amber-800 border-amber-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  refunded: "bg-sky-100 text-sky-800 border-sky-200",
  failed: "bg-rose-100 text-rose-800 border-rose-200",
};

export const BOOK_LANGUAGE_LABEL_BN: Record<BookLanguage, string> = {
  bangla: "বাংলা",
  english: "ইংরেজি",
  arabic: "আরবি",
  hindi: "হিন্দি",
  other: "অন্যান্য",
};

export const BOOK_BINDING_LABEL_BN: Record<BookBinding, string> = {
  paperback: "পেপারব্যাক",
  hardcover: "হার্ডকভার",
  spiral: "স্পাইরাল",
  ebook: "ই-বুক",
};

export const COURIERS = [
  "Pathao Courier",
  "Steadfast Courier",
  "RedX",
  "Sundarban Courier",
  "কুরিয়ার Office Pickup",
  "নিজস্ব ডেলিভারি",
] as const;

/* ============================== অন্যান্য ============================== */

/** এক পেজে কত বই দেখাবে। */
export const BOOKS_PER_PAGE = 12;

/** একটি অর্ডারে সর্বোচ্চ কত ধরনের বই (ডেটাবেস ফাংশনের সাথে মিল রাখতে হবে)। */
export const MAX_CART_LINES = 25;

/** একটি লাইনে সর্বোচ্চ কত কপি। */
export const MAX_QTY_PER_LINE = 20;

export const CART_STORAGE_KEY = "boighor.cart.v1";
