import { describe, expect, it } from "vitest";
import {
  EMPTY_CHECKOUT,
  isValidBdPhone,
  normalizePhone,
  validateCheckout,
  type CheckoutForm,
} from "@/lib/validation";

describe("normalizePhone", () => {
  it("দেশের কোড সহ নম্বর ঠিক করে", () => {
    expect(normalizePhone("+8801712345678")).toBe("01712345678");
    expect(normalizePhone("8801712345678")).toBe("01712345678");
  });

  it("স্পেস ও ড্যাশ সরায়", () => {
    expect(normalizePhone("017 1234-5678")).toBe("01712345678");
    expect(normalizePhone("  01712345678  ")).toBe("01712345678");
  });

  it("আগেই ঠিক থাকলে অপরিবর্তিত রাখে", () => {
    expect(normalizePhone("01712345678")).toBe("01712345678");
  });
});

describe("isValidBdPhone", () => {
  it("সব অপারেটরের সঠিক নম্বর গ্রহণ করে", () => {
    // 013 = Grameenphone, 014 = Banglalink, 015 = Teletalk,
    // 016 = Airtel, 017 = GP, 018 = Robi, 019 = Banglalink
    ["01312345678", "01412345678", "01512345678", "01612345678",
     "01712345678", "01812345678", "01912345678"].forEach((n) => {
      expect(isValidBdPhone(n), `${n} বৈধ হওয়া উচিত`).toBe(true);
    });
  });

  it("ভুল নম্বর প্রত্যাখ্যান করে", () => {
    expect(isValidBdPhone("0171234567")).toBe(false); // ১০ ডিজিট
    expect(isValidBdPhone("017123456789")).toBe(false); // ১২ ডিজিট
    expect(isValidBdPhone("01212345678")).toBe(false); // 012 নেই
    expect(isValidBdPhone("02712345678")).toBe(false); // 02 দিয়ে শুরু নয়
    expect(isValidBdPhone("")).toBe(false);
  });

  it("+880 ফরম্যাটও গ্রহণ করে", () => {
    expect(isValidBdPhone("+8801712345678")).toBe(true);
  });
});

/** সব ফিল্ড ঠিক থাকা একটি ফর্ম — তারপর এক এক করে ভাঙা হবে */
function validForm(overrides: Partial<CheckoutForm> = {}): CheckoutForm {
  return {
    ...EMPTY_CHECKOUT,
    customer_name: "আরেফাতুল রুমন",
    customer_phone: "01712345678",
    division: "ঢাকা",
    district: "ঢাকা",
    address_line: "বাসা ১২, রোড ৫, মিরপুর ১০",
    payment_method: "cod",
    ...overrides,
  };
}

describe("validateCheckout", () => {
  it("সঠিক ফর্মে কোনো এরর নেই", () => {
    expect(validateCheckout(validForm())).toEqual({});
  });

  it("নাম ছোট হলে ধরে", () => {
    expect(validateCheckout(validForm({ customer_name: "আ" })).customer_name)
      .toBeDefined();
    expect(validateCheckout(validForm({ customer_name: "   " })).customer_name)
      .toBeDefined();
  });

  it("ফোন ভুল হলে ধরে", () => {
    expect(validateCheckout(validForm({ customer_phone: "123" })).customer_phone)
      .toBeDefined();
  });

  it("বিভাগ/জেলা না বাছলে ধরে", () => {
    const e = validateCheckout(validForm({ division: "", district: "" }));
    expect(e.division).toBeDefined();
    expect(e.district).toBeDefined();
  });

  it("ঠিকানা ১০ অক্ষরের কম হলে ধরে", () => {
    expect(validateCheckout(validForm({ address_line: "মিরপুর" })).address_line)
      .toBeDefined();
  });

  it("পোস্ট কোড ৪ সংখ্যার না হলে ধরে", () => {
    expect(validateCheckout(validForm({ postcode: "12" })).postcode).toBeDefined();
    expect(validateCheckout(validForm({ postcode: "1216" })).postcode).toBeUndefined();
  });

  it("ইমেইল ভুল হলে ধরে, খালি থাকলে ধরে না", () => {
    expect(validateCheckout(validForm({ customer_email: "abc" })).customer_email)
      .toBeDefined();
    expect(validateCheckout(validForm({ customer_email: "" })).customer_email)
      .toBeUndefined();
    expect(validateCheckout(validForm({ customer_email: "a@b.com" })).customer_email)
      .toBeUndefined();
  });

  it("bKash/Nagad এ TrxID ছাড়া ছাড়ে না", () => {
    const e = validateCheckout(
      validForm({ payment_method: "bkash", payment_ref: "" })
    );
    expect(e.payment_ref).toBeDefined();
  });

  it("bKash/Nagad এ TrxID দিলে ছাড়ে", () => {
    const e = validateCheckout(
      validForm({ payment_method: "nagad", payment_ref: "9F2K1L7M3Q" })
    );
    expect(e.payment_ref).toBeUndefined();
  });

  it("COD এ TrxID লাগে না", () => {
    const e = validateCheckout(validForm({ payment_method: "cod", payment_ref: "" }));
    expect(e.payment_ref).toBeUndefined();
  });

  it("একাধিক সমস্যা একসাথে ধরে", () => {
    const e = validateCheckout({
      ...EMPTY_CHECKOUT,
      payment_method: "cod",
    });
    expect(Object.keys(e).length).toBeGreaterThanOrEqual(4);
  });
});
