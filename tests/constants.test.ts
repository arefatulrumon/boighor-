import { describe, expect, it } from "vitest";
import {
  BOOK_BINDING_LABEL_BN,
  BOOK_LANGUAGE_LABEL_BN,
  DIVISIONS,
  DISTRICTS_BY_DIVISION,
  ORDER_FLOW,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL_BN,
  PAYMENT_METHOD_LABEL_BN,
  PAYMENT_STATUS_LABEL_BN,
  type Division,
} from "@/lib/constants";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/types/database";

describe("বিভাগ ও জেলা", () => {
  it("৮টি বিভাগ আছে", () => {
    expect(DIVISIONS.length).toBe(8);
  });

  it("প্রতিটি বিভাগের জেলার তালিকা আছে (খালি নয়)", () => {
    DIVISIONS.forEach((d) => {
      expect(DISTRICTS_BY_DIVISION[d], `${d} এর তালিকা নেই`).toBeDefined();
      expect(DISTRICTS_BY_DIVISION[d].length).toBeGreaterThan(0);
    });
  });

  it("মোট ৬৪টি জেলা", () => {
    const total = DIVISIONS.reduce(
      (sum, d) => sum + DISTRICTS_BY_DIVISION[d].length,
      0
    );
    expect(total).toBe(64);
  });

  it("DIVISIONS এর বাইরে কোনো চাবি নেই", () => {
    Object.keys(DISTRICTS_BY_DIVISION).forEach((key) => {
      expect(DIVISIONS).toContain(key as Division);
    });
  });

  it("একই বিভাগে দুবার একই জেলা নেই", () => {
    DIVISIONS.forEach((d) => {
      const list = DISTRICTS_BY_DIVISION[d];
      expect(new Set(list).size, `${d} এ ডুপ্লিকেট জেলা`).toBe(list.length);
    });
  });

  it("জেলার নাম খালি নয়", () => {
    DIVISIONS.forEach((d) => {
      DISTRICTS_BY_DIVISION[d].forEach((district) => {
        expect(district.trim().length).toBeGreaterThan(0);
      });
    });
  });
});

describe("লেবেল ম্যাপ — সব মান কভার করা আছে কি না", () => {
  it("সব অর্ডার স্টেটাসের বাংলা লেবেল ও রঙ আছে", () => {
    const all: OrderStatus[] = [
      "pending", "confirmed", "packed", "shipped",
      "delivered", "cancelled", "returned",
    ];
    all.forEach((s) => {
      expect(ORDER_STATUS_LABEL_BN[s], `${s} এর লেবেল নেই`).toBeTruthy();
      expect(ORDER_STATUS_COLOR[s], `${s} এর রঙ নেই`).toBeTruthy();
    });
  });

  it("সব পেমেন্ট মাধ্যমের লেবেল আছে", () => {
    (["cod", "bkash", "nagad"] as PaymentMethod[]).forEach((m) => {
      expect(PAYMENT_METHOD_LABEL_BN[m]).toBeTruthy();
    });
  });

  it("সব পেমেন্ট স্টেটাসের লেবেল আছে", () => {
    (["unpaid", "pending_verification", "paid", "refunded", "failed"] as PaymentStatus[])
      .forEach((s) => {
        expect(PAYMENT_STATUS_LABEL_BN[s]).toBeTruthy();
      });
  });

  it("সব ভাষা ও বাঁধাইয়ের লেবেল আছে", () => {
    (["bangla", "english", "arabic", "hindi", "other"] as const).forEach((l) => {
      expect(BOOK_LANGUAGE_LABEL_BN[l]).toBeTruthy();
    });
    (["paperback", "hardcover", "spiral", "ebook"] as const).forEach((b) => {
      expect(BOOK_BINDING_LABEL_BN[b]).toBeTruthy();
    });
  });
});

describe("ORDER_FLOW", () => {
  it("স্বাভাবিক ক্রমে সাজানো", () => {
    expect(ORDER_FLOW).toEqual([
      "pending", "confirmed", "packed", "shipped", "delivered",
    ]);
  });

  it("বাতিল/ফেরত ধাপগুলো এতে নেই (ওগুলো ব্যতিক্রম)", () => {
    expect(ORDER_FLOW).not.toContain("cancelled");
    expect(ORDER_FLOW).not.toContain("returned");
  });
});
