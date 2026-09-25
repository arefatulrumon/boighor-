"use server";

import { revalidatePath } from "next/cache";
import { FORBIDDEN, requireStaff } from "@/lib/actions/guard";
import {
  getCourierProvider,
  listConfiguredProviders,
  resolveProviderForOrder,
} from "@/lib/courier";
import { COURIER_TO_ORDER_STATUS, COURIER_STATUS_LABEL_BN } from "@/lib/courier/types";
import type { Order, OrderItem } from "@/types/database";

export interface CourierActionResult {
  ok: boolean;
  code?: string;
  message?: string;
  /** UI তে দেখানোর জন্য বাড়তি তথ্য */
  trackingCode?: string;
  consignmentId?: string;
  statusLabel?: string;
}

/** কুরিয়ারকে দেওয়ার জন্য এক লাইনের ঠিকানা (SteadFast সর্বোচ্চ ২৫০ অক্ষর নেয়) */
function buildAddress(order: Order): string {
  const parts = [
    order.address_line,
    order.area,
    order.district,
    order.division,
    order.postcode,
  ].filter(Boolean);
  return parts.join(", ").slice(0, 250);
}

function buildItemDescription(items: OrderItem[]): string {
  const first = items[0]?.title_snapshot ?? "বই";
  const extra = items.length > 1 ? ` + ${items.length - 1}টি বই` : "";
  return `${first}${extra}`.slice(0, 250);
}

/* ==========================================================================
 *  কুরিয়ারে বুক করা
 * ========================================================================== */
export async function bookCourierOrder(formData: FormData): Promise<CourierActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return { ok: false, code: "MISSING_INPUT", message: "অর্ডার আইডি নেই।" };

  const { data: orderData, error: orderError } = await guard.supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !orderData) {
    return { ok: false, code: "NOT_FOUND", message: "অর্ডারটি পাওয়া যায়নি।" };
  }

  const order = orderData as unknown as Order & { order_items: OrderItem[] };

  // ---- আগেই বুক হয়ে গেছে কি না ----
  if (order.tracking_code) {
    return {
      ok: false,
      code: "ALREADY_BOOKED",
      message: `এই অর্ডার আগেই বুক করা হয়েছে (${order.tracking_code})।`,
      trackingCode: order.tracking_code,
    };
  }

  if (["delivered", "cancelled", "returned"].includes(order.status)) {
    return {
      ok: false,
      code: "BAD_STATUS",
      message: "সম্পন্ন/বাতিল অর্ডার কুরিয়ারে দেওয়া যায় না।",
    };
  }

  // ---- কোন কুরিয়ার? ----
  const requestedId = String(formData.get("provider") || "");
  const provider =
    getCourierProvider(requestedId) ??
    resolveProviderForOrder(order.courier) ??
    listConfiguredProviders()[0] ??
    null;

  if (!provider) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message:
        "কোনো কুরিয়ারের API কী সেট করা নেই। .env.local এ STEADFAST_API_KEY ও STEADFAST_SECRET_KEY বসান, অথবা ট্র্যাকিং কোড হাতে লিখুন।",
    };
  }

  if (!provider.isConfigured()) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: `${provider.name} এর API কী সেট করা নেই।`,
    };
  }

  // ---- বুকিং ----
  const result = await provider.createBooking({
    invoice: order.order_number,
    recipientName: order.customer_name,
    recipientPhone: order.customer_phone,
    recipientAddress: buildAddress(order),
    // অগ্রিম পেমেন্ট নেওয়া হলে কুরিয়ারকে টাকা তুলতে বলা যাবে না
    codAmount: order.payment_method === "cod" ? Number(order.total) : 0,
    note: order.delivery_note,
    itemDescription: buildItemDescription(order.order_items ?? []),
    totalLot: order.order_items?.reduce((sum, i) => sum + i.quantity, 0) ?? 1,
    recipientEmail: order.customer_email,
  });

  if (!result.ok) {
    console.error("[bookCourierOrder]", result.code, result.message);
    return { ok: false, code: result.code, message: result.message };
  }

  const { consignmentId, trackingCode } = result.data;

  // ---- তথ্য সেভ + স্টেটাস "পাঠানো হয়েছে" ----
  const save = await guard.supabase.rpc("admin_set_courier_info", {
    p_order_id: order.id,
    p_courier: provider.name,
    p_consignment_id: consignmentId,
    p_tracking_code: trackingCode,
  });

  if (!save.error) {
    await guard.supabase.rpc("admin_set_order_status", {
      p_order_id: order.id,
      p_status: "shipped",
      p_note: `${provider.name} এ বুক করা হয়েছে — ট্র্যাকিং ${trackingCode}`,
      p_courier: provider.name,
      p_tracking_code: trackingCode,
    });
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");

  return { ok: true, trackingCode, consignmentId };
}

/* ==========================================================================
 *  কুরিয়ার থেকে স্টেটাস টেনে আনা (একটি অর্ডার)
 * ========================================================================== */
export async function syncOrderCourierStatus(
  formData: FormData
): Promise<CourierActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return { ok: false, code: "MISSING_INPUT", message: "অর্ডার আইডি নেই।" };

  const { data: orderData } = await guard.supabase
    .from("orders")
    .select("id, courier, tracking_code, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderData) return { ok: false, code: "NOT_FOUND", message: "অর্ডার পাওয়া যায়নি।" };

  const order = orderData as Pick<Order, "id" | "courier" | "tracking_code" | "status">;

  if (!order.tracking_code) {
    return {
      ok: false,
      code: "NO_TRACKING",
      message: "এই অর্ডারে ট্র্যাকিং কোড নেই — আগে কুরিয়ারে বুক করুন।",
    };
  }

  const provider = resolveProviderForOrder(order.courier);
  if (!provider || !provider.isConfigured()) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "এই কুরিয়ারের API কী সেট করা নেই।",
    };
  }

  const result = await provider.getStatusByTrackingCode(order.tracking_code);
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }

  const courierStatus = result.data;
  const mapped = COURIER_TO_ORDER_STATUS[courierStatus];

  // চেনা যায়নি বা সরাসরি সমতুল্য নেই → স্টেটাস বদলানো হবে না
  if (!mapped) {
    revalidatePath(`/admin/orders/${order.id}`);
    return {
      ok: true,
      code: "NO_CHANGE",
      statusLabel: COURIER_STATUS_LABEL_BN[courierStatus],
      message: `কুরিয়ার স্টেটাস: ${COURIER_STATUS_LABEL_BN[courierStatus]} — অর্ডারের স্টেটাস অপরিবর্তিত রাখা হয়েছে।`,
    };
  }

  const { data, error } = await guard.supabase.rpc("admin_sync_courier_status", {
    p_order_id: order.id,
    p_new_status: mapped,
    p_note: `কুরিয়ার স্টেটাস: ${COURIER_STATUS_LABEL_BN[courierStatus]}`,
  });

  if (error) {
    console.error("[syncOrderCourierStatus]", error.message);
    return { ok: false, code: "SERVER_ERROR", message: "স্টেটাস সেভ করা যায়নি।" };
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  return {
    ok: true,
    statusLabel: COURIER_STATUS_LABEL_BN[courierStatus],
    message: `কুরিয়ার স্টেটাস: ${COURIER_STATUS_LABEL_BN[courierStatus]}`,
    ...(typeof data === "object" && data ? { code: "SYNCED" } : {}),
  };
}

/* ==========================================================================
 *  তথ্য: কোন কুরিয়ারগুলো চালু আছে
 * ========================================================================== */
export async function getCourierStatus(): Promise<{
  providers: Array<{ id: string; name: string; configured: boolean }>;
}> {
  const { listCourierProviders: list } = await import("@/lib/courier");
  return {
    providers: list().map((p) => ({
      id: p.id,
      name: p.name,
      configured: p.isConfigured(),
    })),
  };
}
