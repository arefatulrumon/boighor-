import { describe, expect, it } from "vitest";
import {
  discountPercent,
  formatDateBn,
  formatTaka,
  shortId,
  stockState,
  toBanglaDigits,
} from "@/lib/format";

describe("toBanglaDigits", () => {
  it("ইংরেজি সংখ্যা বাংলায় বদলায়", () => {
    expect(toBanglaDigits(1234)).toBe("১২৩৪");
    expect(toBanglaDigits(0)).toBe("০");
    expect(toBanglaDigits("BK260924-0001")).toBe("BK২৬০৯২৪-০০০১");
  });

  it("সংখ্যা না থাকলে অপরিবর্তিত রাখে", () => {
    expect(toBanglaDigits("ঢাকা")).toBe("ঢাকা");
    expect(toBanglaDigits("")).toBe("");
  });
});

describe("formatTaka", () => {
  it("ডিফল্টভাবে বাংলা সংখ্যা ও 'টাকা' যোগ করে", () => {
    expect(formatTaka(450)).toBe("৪৫০ টাকা");
    expect(formatTaka(1250)).toBe("১,২৫০ টাকা");
  });

  it("symbol দিলে ৳ চিহ্ন দেয়", () => {
    expect(formatTaka(450, { symbol: true })).toBe("৳৪৫০");
    expect(formatTaka(12500, { symbol: true })).toBe("৳১২,৫০০");
  });

  it("bangla: false দিলে ইংরেজি সংখ্যা থাকে", () => {
    expect(formatTaka(1250, { bangla: false })).toBe("1,250 টাকা");
  });

  it("দশমিক থাকলে দুই ঘর দেখায়, না থাকলে লুকায়", () => {
    expect(formatTaka(450.5, { bangla: false })).toBe("450.50 টাকা");
    expect(formatTaka(450.0, { bangla: false })).toBe("450 টাকা");
  });

  it("null / undefined / ভুল মানে ৳০ দেয় (ক্র্যাশ করে না)", () => {
    expect(formatTaka(null, { symbol: true })).toBe("৳০");
    expect(formatTaka(undefined)).toBe("০ টাকা");
    expect(formatTaka("abc")).toBe("০ টাকা");
  });
});

describe("discountPercent", () => {
  it("ছাড়ের শতাংশ হিসাব করে", () => {
    expect(discountPercent(450, 550)).toBe(18); // (550-450)/550 ≈ 18.18%
    expect(discountPercent(500, 1000)).toBe(50);
  });

  it("আগের দাম না থাকলে বা বেশি না হলে null", () => {
    expect(discountPercent(450, null)).toBeNull();
    expect(discountPercent(450, undefined)).toBeNull();
    expect(discountPercent(450, 450)).toBeNull();
    expect(discountPercent(450, 400)).toBeNull();
  });
});

describe("stockState", () => {
  it("স্টক শেষ হলে out", () => {
    expect(stockState(0)).toEqual({ label: "স্টক শেষ", tone: "out" });
    expect(stockState(-1)).toEqual({ label: "স্টক শেষ", tone: "out" });
  });

  it("কম স্টকে বাংলা সংখ্যায় সতর্কতা", () => {
    expect(stockState(2, 3)).toEqual({ label: "মাত্র ২ কপি বাকি", tone: "low" });
    expect(stockState(3, 3)).toEqual({ label: "মাত্র ৩ কপি বাকি", tone: "low" });
  });

  it("যথেষ্ট স্টকে কোনো লেবেল থাকে না", () => {
    expect(stockState(10, 3)).toEqual({ label: null, tone: "ok" });
  });
});

describe("formatDateBn", () => {
  it("বাংলা মাসের নাম ও বাংলা সংখ্যা দেয়", () => {
    const out = formatDateBn("2026-09-24T06:00:00Z");
    expect(out).toContain("সেপ্টেম্বর");
    expect(out).toContain("২০২৬");
    expect(out).toMatch(/[০-৯]/);
  });

  it("খালি বা ভুল তারিখে ড্যাশ দেয়", () => {
    expect(formatDateBn(null)).toBe("—");
    expect(formatDateBn("not-a-date")).toBe("—");
  });
});

describe("shortId", () => {
  it("প্রথম ৮ অক্ষর নেয়", () => {
    expect(shortId("3f2a1b4c-9d8e-7f6a-5b4c-3d2e1f0a9b8c")).toBe("3f2a1b4c");
  });
});
