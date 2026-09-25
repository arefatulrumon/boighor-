import type { OrderStatus } from "@/types/database";

/**
 * কুরিয়ার ইন্টিগ্রেশনের সাধারণ চুক্তি (contract)।
 *
 * একই ইন্টারফেস মানলে Pathao / RedX / SteadFast — যেকোনোটা যোগ করা যায়,
 * বাকি অ্যাপের কোড ছুঁতে হবে না।
 */

/** কুরিয়ার থেকে পাওয়া স্টেটাসের সম্ভাব্য মানগুলো */
export type CourierStatus =
  | "pending" // কুরিয়ারে জমা হয়েছে, এখনো প্রসেস হয়নি
  | "in_review" // কুরিয়ার যাচাই করছে
  | "on_hold" // আটকে আছে (কাস্টমার ফোন ধরছে না ইত্যাদি)
  | "in_transit" // পথে
  | "out_for_delivery" // ডেলিভারির জন্য বের হয়েছে
  | "delivered" // পৌঁছে গেছে
  | "partial_delivered" // আংশিক পৌঁছেছে (COD আংশিক নেওয়া)
  | "cancelled" // বাতিল
  | "returned" // ফেরত এসেছে
  | "delivery_failed" // ডেলিভারি ব্যর্থ
  | "unknown"; // চেনা যায়নি — স্টেটাস বদলানো হবে না

/**
 * কুরিয়ারের স্টেটাস → আমাদের অর্ডার স্টেটাস।
 * `null` মানে "কিছু বদলাব না" — যেমন "in_transit" এ আমাদের হয়তো
 * সরাসরি সমতুল্য কিছু নেই, তখন "shipped" ই রাখা ভালো।
 */
export const COURIER_TO_ORDER_STATUS: Record<CourierStatus, OrderStatus | null> = {
  pending: "shipped",
  in_review: "shipped",
  on_hold: null, // আমাদের ধারণক্ষমতার বাইরে — হাতে দেখতে হবে
  in_transit: "shipped",
  out_for_delivery: "shipped",
  delivered: "delivered",
  partial_delivered: "delivered", // টাকা এসেছে, তাই ডেলিভারড ধরাই ঠিক
  cancelled: "cancelled",
  returned: "returned",
  delivery_failed: null, // কুরিয়ার আবার চেষ্টা করতে পারে
  unknown: null,
};

/** বাংলায় দেখানোর লেবেল */
export const COURIER_STATUS_LABEL_BN: Record<CourierStatus, string> = {
  pending: "কুরিয়ারে জমা",
  in_review: "যাচাই চলছে",
  on_hold: "আটকে আছে",
  in_transit: "পরিবহনে",
  out_for_delivery: "ডেলিভারির পথে",
  delivered: "ডেলিভারড",
  partial_delivered: "আংশিক ডেলিভারড",
  cancelled: "বাতিল",
  returned: "ফেরত এসেছে",
  delivery_failed: "ডেলিভারি ব্যর্থ",
  unknown: "অজানা",
};

/** কুরিয়ার বুকিংয়ের ইনপুট — কোনো কুরিয়ার-নির্দিষ্ট কিছু নেই */
export interface CourierBookingInput {
  /** আমাদের অর্ডার নম্বরই invoice হিসেবে যাবে (যেমন BK260924-0001) */
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  /** ক্যাশ অন ডেলিভারিতে কত টাকা তোলা হবে (অগ্রিম হলে 0) */
  codAmount: number;
  note?: string | null;
  itemDescription?: string | null;
  totalLot?: number;
  alternativePhone?: string | null;
  recipientEmail?: string | null;
}

/** কুরিয়ার বুকিং সফল হলে যা ফেরত আসে */
export interface CourierShipment {
  consignmentId: string;
  trackingCode: string;
  status: CourierStatus;
  raw: unknown;
}

export type CourierResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: CourierErrorCode; message: string };

export type CourierErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "NETWORK"
  | "SERVER_ERROR";

export interface CourierProvider {
  /** ইউনিক আইডি — env ভেরিয়েবলে এটাই ব্যবহার হয় */
  id: string;
  /** বাংলায় নাম (UI তে দেখানো হয়) */
  name: string;
  /** ক্রেডেনশিয়াল বসানো আছে কি না */
  isConfigured(): boolean;
  /** নতুন শিপমেন্ট বুক করা */
  createBooking(input: CourierBookingInput): Promise<CourierResult<CourierShipment>>;
  /** ট্র্যাকিং কোড দিয়ে স্টেটাস জানা */
  getStatusByTrackingCode(code: string): Promise<CourierResult<CourierStatus>>;
}

/** কুরিয়ারের কাঁচা স্টেটাস স্ট্রিং → আমাদের CourierStatus */
export function normalizeCourierStatus(raw: string | null | undefined): CourierStatus {
  const s = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, CourierStatus> = {
    pending: "pending",
    in_review: "in_review",
    "in_review_approval_pending": "in_review",
    hold: "on_hold",
    on_hold: "on_hold",
    "on_hold_approval_pending": "on_hold",
    in_transit: "in_transit",
    picked: "in_transit",
    pickup_pending: "pending",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered",
    "delivered_approval_pending": "delivered",
    partial_delivered: "partial_delivered",
    "partial_delivered_approval_pending": "partial_delivered",
    cancelled: "cancelled",
    "cancelled_approval_pending": "cancelled",
    returned: "returned",
    return: "returned",
    delivery_failed: "delivery_failed",
    undelivered: "delivery_failed",
  };
  return map[s] ?? "unknown";
}
