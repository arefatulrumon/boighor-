"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, type CheckoutForm } from "@/lib/validation";
import type {
  CouponCheckResult,
  CreateOrderResult,
  TrackOrderResult,
} from "@/types/database";

export interface PlaceOrderInput extends CheckoutForm {
  items: Array<{ book_id: string; quantity: number }>;
}

export type PlaceOrderResult = CreateOrderResult;

/**
 * অর্ডার তৈরি।
 *
 * ক্লায়েন্ট থেকে শুধু book_id + quantity আর কাস্টমার তথ্য আসে —
 * দাম/স্টক/ডেলিভারি চার্জ/ডিসকাউন্ট সব ডেটাবেসের `create_order()` ফাংশনে
 * হিসাব হয়। তাই DevTools দিয়ে দাম বদলানোর কোনো সুযোগ নেই।
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  if (!input.items?.length) {
    return { ok: false, code: "EMPTY_CART", message: "আপনার কার্ট খালি।" };
  }

  const supabase = await createClient();
  const phone = normalizePhone(input.customer_phone);

  /*
   * স্প্যাম ঠেকানো — প্রথম স্তর।
   *
   * এখানে আগেই জিজ্ঞেস করা হয়, যাতে কাস্টমার সুন্দর বাংলা বার্তা পায়।
   * (দ্বিতীয় স্তর ডেটাবেসে: `trg_orders_rate_limit` ট্রিগার — সেটা
   *  একসাথে অনেক রিকোয়েস্ট এলে রেস-কন্ডিশনও বন্ধ করে।)
   * migration: 20260924000006_rate_limit.sql
   */
  const { data: limitCheck } = await supabase.rpc("order_rate_limit_check", {
    p_phone: phone,
  });

  const limit = limitCheck as
    | { allowed: true }
    | { allowed: false; code: string; message: string }
    | null;

  if (limit && limit.allowed === false) {
    return { ok: false, code: limit.code, message: limit.message };
  }

  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: input.customer_name,
    p_customer_phone: normalizePhone(input.customer_phone),
    p_customer_email: input.customer_email || null,
    p_division: input.division,
    p_district: input.district,
    p_area: input.area || null,
    p_address_line: input.address_line,
    p_postcode: input.postcode || null,
    p_delivery_note: input.delivery_note || null,
    p_payment_method: input.payment_method,
    p_payment_ref: input.payment_ref || null,
    p_payment_sender_phone: input.payment_sender_phone
      ? normalizePhone(input.payment_sender_phone)
      : null,
    p_coupon_code: input.coupon_code || null,
    p_items: input.items.map((i) => ({
      book_id: i.book_id,
      quantity: i.quantity,
    })),
  });

  if (error) {
    console.error("[placeOrder] RPC ব্যর্থ:", error.message);

    // ডেটাবেসের রেট-লিমিট ট্রিগার P0001 দিয়ে থামায় (রেস-কন্ডিশনের ক্ষেত্রে)
    if (error.code === "P0001") {
      if (error.message.includes("RATE_LIMITED")) {
        return {
          ok: false,
          code: "RATE_LIMITED",
          message:
            "এই নম্বর থেকে সদ্য কয়েকটি অর্ডার এসেছে। ১০ মিনিট পর আবার চেষ্টা করুন, অথবা সরাসরি আমাদের কল করুন।",
        };
      }
      if (error.message.includes("DAILY_LIMIT")) {
        return {
          ok: false,
          code: "DAILY_LIMIT",
          message:
            "এক দিনে এই নম্বর থেকে অনেকগুলো অর্ডার হয়েছে। আমাদের সরাসরি কল করে কথা বলুন।",
        };
      }
    }

    return {
      ok: false,
      code: "SERVER_ERROR",
      message: "সার্ভারে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
    };
  }

  const result = data as PlaceOrderResult;

  /*
   * সফল হলে দুটি httpOnly কুকি সেট করা হয় — অর্ডার নম্বর ও ফোন।
   * কনফার্মেশন পেজ (/order/[orderNumber]) এগুলো দিয়ে order ট্র্যাক করে।
   *
   * কেন URL এ না?  URL ব্রাউজার হিস্টরি, সার্ভার অ্যাক্সেস-লগ আর
   * Referer হেডারে ছড়িয়ে পড়ে। httpOnly কুকি JavaScript-ও পড়তে পারে না।
   */
  if (result.ok) {
    const cookieStore = await cookies();
    const opts = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // ২৪ ঘণ্টা — এরপর অর্ডার নম্বর+ফোন দিয়ে ট্র্যাক করা যাবে
    };
    cookieStore.set("boighor_last_order", result.order_number, opts);
    cookieStore.set("boighor_last_phone", normalizePhone(input.customer_phone), opts);
  }

  return result;
}

/** কুপন যাচাই — শুধু প্রিভিউয়ের জন্য, আসলটা আবার create_order এ হয়। */
export async function checkCoupon(
  code: string,
  subtotal: number
): Promise<CouponCheckResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: code,
    p_subtotal: subtotal,
  });

  if (error) return { valid: false, reason: "SERVER_ERROR" };
  return data as CouponCheckResult;
}

/** অর্ডার ট্র্যাকিং — অর্ডার নম্বর + ফোন দুটোই মিলতে হবে। */
export async function trackOrder(
  orderNumber: string,
  phone: string
): Promise<TrackOrderResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("track_order", {
    p_order_number: orderNumber,
    p_phone: normalizePhone(phone),
  });

  if (error) {
    return { ok: false, code: "SERVER_ERROR", message: "সার্ভারে সমস্যা হয়েছে।" };
  }
  return data as TrackOrderResult;
}
