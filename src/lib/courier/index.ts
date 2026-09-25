import "server-only";

import { steadfast } from "./steadfast";
import type { CourierProvider } from "./types";

/**
 * কুরিয়ার প্রোভাইডারের তালিকা।
 *
 * নতুন কুরিয়ার যোগ করতে:
 *   ১) `src/lib/courier/pathao.ts` বানিয়ে একই CourierProvider ইন্টারফেস মানুন
 *   ২) এখানে `PROVIDERS` অ্যারেতে যোগ করুন
 *   ৩) অ্যাডমিন UI স্বয়ংক্রিয়ভাবে দুটোই দেখাবে — আর কোথাও বদলাতে হবে না
 */
const PROVIDERS: CourierProvider[] = [steadfast];

/** সব প্রোভাইডার (কনফিগ করা হোক বা না হোক) */
export function listCourierProviders(): CourierProvider[] {
  return PROVIDERS;
}

/** যেগুলোর API কী বসানো আছে */
export function listConfiguredProviders(): CourierProvider[] {
  return PROVIDERS.filter((p) => p.isConfigured());
}

/** id দিয়ে একটি প্রোভাইডার খোঁজা */
export function getCourierProvider(id: string | null | undefined): CourierProvider | null {
  if (!id) return null;
  const key = id.trim().toLowerCase().replace(/\s+/g, "");
  return (
    PROVIDERS.find((p) => p.id === key) ??
    PROVIDERS.find((p) => p.name.toLowerCase().replace(/\s+/g, "") === key) ??
    null
  );
}

/**
 * অর্ডারের `courier` কলামে বাংলা নাম লেখা থাকে (যেমন "SteadFast Courier")।
 * এটা দিয়ে প্রোভাইডার খুঁজে বের করা হয়।
 */
export function resolveProviderForOrder(courierField: string | null): CourierProvider | null {
  if (!courierField) return null;
  const normalized = courierField.toLowerCase().replace(/\s+/g, "");
  return (
    PROVIDERS.find((p) => normalized.includes(p.id)) ??
    PROVIDERS.find((p) => p.name.toLowerCase().replace(/\s+/g, "") === normalized) ??
    null
  );
}

export * from "./types";
