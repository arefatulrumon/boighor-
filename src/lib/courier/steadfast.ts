import "server-only";

import {
  normalizeCourierStatus,
  type CourierBookingInput,
  type CourierErrorCode,
  type CourierProvider,
  type CourierResult,
  type CourierShipment,
  type CourierStatus,
} from "./types";

/**
 * SteadFast Courier ইন্টিগ্রেশন।
 *
 * credentials কোথায় পাবেন: https://steadfast.com.bd/ (Merchant Panel → API)
 *
 * নিশ্চিত করা তথ্য (SteadFast এর API ডক অনুযায়ী):
 *   Base URL : https://portal.packzy.com/api/v1
 *   Auth     : Api-Key + Secret-Key হেডার
 *   Endpoints:
 *     POST /create_order
 *     GET  /status_by_cid/{id}
 *     GET  /status_by_invoice/{invoice}
 *     GET  /status_by_trackingcode/{code}
 *     GET  /get_balance
 *
 * ⚠️ কোনো API কী ছাড়া এটি নিষ্ক্রিয় থাকে — `isConfigured()` false দেবে,
 *    আর অ্যাডমিন প্যানেলে "কুরিয়ার সংযুক্ত নয়" দেখাবে। কী না দিলেও
 *    অর্ডার ম্যানুয়ালি (tracking code হাতে লিখে) পরিচালনা করা যাবে।
 */

const DEFAULT_BASE_URL = "https://portal.packzy.com/api/v1";
const TIMEOUT_MS = 20_000;

function baseUrl(): string {
  return (process.env.STEADFAST_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function credentials(): { apiKey: string; secretKey: string } | null {
  const apiKey = process.env.STEADFAST_API_KEY?.trim();
  const secretKey = process.env.STEADFAST_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

/** HTTP স্টেটাস → আমাদের এরর কোড */
function mapHttpError(status: number): CourierErrorCode {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 422 || status === 400) return "VALIDATION";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "SERVER_ERROR";
}

async function request(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<CourierResult<unknown>> {
  const creds = credentials();
  if (!creds) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "SteadFast এর API কী সেট করা হয়নি (STEADFAST_API_KEY / STEADFAST_SECRET_KEY)।",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: init.method,
      headers: {
        "Api-Key": creds.apiKey,
        "Secret-Key": creds.secretKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // JSON নয় — নিচে raw text দেখানো হবে
    }

    if (!res.ok) {
      const detail =
        (parsed as { message?: string } | null)?.message ??
        text.slice(0, 200) ??
        `HTTP ${res.status}`;
      return { ok: false, code: mapHttpError(res.status), message: detail };
    }

    return { ok: true, data: parsed };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, code: "NETWORK", message: "কুরিয়ার সার্ভার সময়মতো উত্তর দেয়নি।" };
    }
    return {
      ok: false,
      code: "NETWORK",
      message: e instanceof Error ? e.message : "নেটওয়ার্ক সমস্যা।",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** SteadFast সাধারণত consignment অবজেক্টের ভেতরে তথ্য দেয় */
function readConsignment(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const c = obj.consignment;
  if (c && typeof c === "object") return c as Record<string, unknown>;
  return obj;
}

export const steadfast: CourierProvider = {
  id: "steadfast",
  name: "SteadFast Courier",

  isConfigured() {
    return credentials() !== null;
  },

  async createBooking(input: CourierBookingInput): Promise<CourierResult<CourierShipment>> {
    // SteadFast এর নিজস্ব সীমা: নাম ১০০, ঠিকানা ২৫০ অক্ষর, ফোন ১১ ডিজিট
    const address = input.recipientAddress.slice(0, 250);
    const name = input.recipientName.slice(0, 100);

    const body = {
      invoice: input.invoice,
      recipient_name: name,
      recipient_phone: input.recipientPhone,
      recipient_address: address,
      cod_amount: Number(input.codAmount.toFixed(2)),
      ...(input.note ? { note: input.note.slice(0, 250) } : {}),
      ...(input.itemDescription
        ? { item_description: input.itemDescription.slice(0, 250) }
        : {}),
      ...(input.totalLot ? { total_lot: input.totalLot } : {}),
      ...(input.alternativePhone ? { alternative_phone: input.alternativePhone } : {}),
      ...(input.recipientEmail ? { recipient_email: input.recipientEmail } : {}),
      delivery_type: 0, // 0 = বাসায় ডেলিভারি, 1 = হাব পিকআপ
    };

    const res = await request("/create_order", { method: "POST", body });
    if (!res.ok) return res;

    const consignment = readConsignment(res.data);
    const consignmentId = consignment?.consignment_id;
    const trackingCode = consignment?.tracking_code;

    if (!consignmentId || !trackingCode) {
      return {
        ok: false,
        code: "SERVER_ERROR",
        message: "কুরিয়ার থেকে প্রত্যাশিত উত্তর আসেনি (consignment_id/tracking_code নেই)।",
      };
    }

    return {
      ok: true,
      data: {
        consignmentId: String(consignmentId),
        trackingCode: String(trackingCode),
        status: normalizeCourierStatus(consignment?.status as string | undefined),
        raw: res.data,
      },
    };
  },

  async getStatusByTrackingCode(code: string): Promise<CourierResult<CourierStatus>> {
    if (!code?.trim()) {
      return { ok: false, code: "VALIDATION", message: "ট্র্যাকিং কোড দেওয়া হয়নি।" };
    }

    const res = await request(
      `/status_by_trackingcode/${encodeURIComponent(code.trim())}`,
      { method: "GET" }
    );
    if (!res.ok) return res;

    const obj = (res.data ?? {}) as Record<string, unknown>;
    const raw =
      (obj.delivery_status as string | undefined) ??
      (obj.status as string | undefined) ??
      ((obj.data as Record<string, unknown> | undefined)?.delivery_status as string | undefined);

    const status = normalizeCourierStatus(raw);

    // চেনা না গেলে স্টেটাস বদলানো হবে না, কিন্তু লগ রাখা হয় যাতে পরে ম্যাপ যোগ করা যায়
    if (status === "unknown" && raw) {
      console.warn(`[courier/steadfast] অজানা স্টেটাস পাওয়া গেছে: "${raw}" (${code})`);
    }

    return { ok: true, data: status };
  },
};
