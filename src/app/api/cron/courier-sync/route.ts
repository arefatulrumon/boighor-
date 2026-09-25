import { NextResponse, type NextRequest } from "next/server";
import { resolveProviderForOrder } from "@/lib/courier";
import { COURIER_TO_ORDER_STATUS } from "@/lib/courier/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/types/database";

/**
 * কুরিয়ার স্টেটাস স্বয়ংক্রিয়ভাবে সিঙ্ক (Vercel Cron থেকে চলে)।
 *
 * প্রতি ৬ ঘণ্টায় যেসব অর্ডার পাঠানো হয়েছে কিন্তু ডেলিভারি হয়নি,
 * সেগুলোর স্টেটাস কুরিয়ার থেকে টেনে আনা হয়। ফলে "কাস্টমার পেয়েছে কি না"
 * নিজে নিজেই আপডেট হয়ে যায় — হাতে দেখতে হয় না।
 *
 * ⚠️ নিরাপত্তা: এই রুটে কোনো ইউজার সেশন নেই, তাই
 *    `Authorization: Bearer <CRON_SECRET>` দিয়ে সুরক্ষিত।
 *    Vercel নিজেই Cron কলের সময় এই হেডার বসায়।
 *
 * সময়সূচি `vercel.json` এর `crons` ব্লকে দেওয়া আছে — প্রতি ৬ ঘণ্টায় একবার।
 * (লেখার সময় খেয়াল রাখুন: Cron এক্সপ্রেশনে `*` আর `/` পাশাপাশি থাকলে
 *  তা এই কমেন্ট ব্লকটাই ভেঙে দিতে পারে।)
 */

// ⚠️ Next.js 16 এ route handler অবশ্যই dynamic হতে হবে (ক্যাশ করা যাবে না)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    // ইচ্ছাকৃতভাবে অস্পষ্ট বার্তা — ভেতরের কনফিগ ফাঁস না করা
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // secret key ক্লায়েন্ট — কারণ `orders_needing_courier_sync()` ও
  // `system_sync_courier_status()` anon/authenticated এর জন্য বন্ধ।
  const supabase = createAdminClient();

  const { data: pending, error } = await supabase.rpc("orders_needing_courier_sync", {
    p_limit: 40,
  });

  if (error) {
    console.error("[cron/courier-sync] তালিকা আনা যায়নি:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const orders = (pending ?? []) as Array<
    Pick<Order, "id" | "order_number" | "courier" | "tracking_code">
  >;

  if (orders.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, updated: 0, skipped: 0 });
  }

  let updated = 0;
  let skipped = 0;
  const failures: Array<{ order: string; reason: string }> = [];

  for (const order of orders) {
    if (!order.tracking_code) {
      skipped += 1;
      continue;
    }

    const provider = resolveProviderForOrder(order.courier);
    if (!provider || !provider.isConfigured()) {
      skipped += 1;
      continue;
    }

    const statusResult = await provider.getStatusByTrackingCode(order.tracking_code);
    if (!statusResult.ok) {
      failures.push({ order: order.order_number, reason: statusResult.code });
      continue;
    }

    const mapped = COURIER_TO_ORDER_STATUS[statusResult.data];
    if (!mapped) {
      skipped += 1; // in_transit / on_hold ইত্যাদি — অর্ডার বদলানোর দরকার নেই
      continue;
    }

    const { error: syncError } = await supabase.rpc("system_sync_courier_status", {
      p_order_id: order.id,
      p_new_status: mapped,
      p_note: "কুরিয়ার থেকে স্বয়ংক্রিয় সিঙ্ক (Cron)",
    });

    if (syncError) {
      failures.push({ order: order.order_number, reason: syncError.message });
    } else {
      updated += 1;
    }

    // কুরিয়ারের API-কে চাপ না দেওয়া — ছোট বিরতি
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (failures.length > 0) {
    console.warn("[cron/courier-sync] কিছু ব্যর্থ:", failures);
  }

  return NextResponse.json({
    ok: true,
    checked: orders.length,
    updated,
    skipped,
    failed: failures.length,
  });
}
