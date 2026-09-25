/**
 * ক্লায়েন্ট-সাইড ভ্যালিডেশন।
 *
 * ⚠️ এটা শুধু UX এর জন্য (দ্রুত এরর দেখানো)।
 *    আসল নিরাপত্তা আসে ডেটাবেসের `create_order()` ফাংশন থেকে, যেটা
 *    একই নিয়ম আবার যাচাই করে। দুটো জায়গায় নিয়ম মিলিয়ে রাখুন।
 */

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

/** 01712345678 / +8801712345678 / 017 1234-5678 — সবই গ্রহণ করে */
export function normalizePhone(input: string): string {
  const d = (input || "").replace(/[^0-9]/g, "");
  if (d.startsWith("880") && d.length === 13) return "0" + d.slice(3);
  return d;
}

export function isValidBdPhone(input: string): boolean {
  return /^01[3-9][0-9]{8}$/.test(normalizePhone(input));
}

export interface CheckoutForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  division: string;
  district: string;
  area: string;
  address_line: string;
  postcode: string;
  delivery_note: string;
  payment_method: string;
  payment_ref: string;
  payment_sender_phone: string;
  coupon_code: string;
}

export const EMPTY_CHECKOUT: CheckoutForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  division: "",
  district: "",
  area: "",
  address_line: "",
  postcode: "",
  delivery_note: "",
  payment_method: "cod",
  payment_ref: "",
  payment_sender_phone: "",
  coupon_code: "",
};

export function validateCheckout(
  form: CheckoutForm
): FieldErrors<keyof CheckoutForm> {
  const e: FieldErrors<keyof CheckoutForm> = {};

  if (form.customer_name.trim().length < 3) {
    e.customer_name = "কমপক্ষে ৩ অক্ষরের নাম লিখুন।";
  } else if (form.customer_name.trim().length > 80) {
    e.customer_name = "নাম অনেক বড় হয়ে গেছে।";
  }

  if (!isValidBdPhone(form.customer_phone)) {
    e.customer_phone = "সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।";
  }

  if (form.customer_email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.customer_email.trim())) {
      e.customer_email = "ইমেইল ঠিকানাটা ঠিক মনে হচ্ছে না।";
    }
  }

  if (!form.division) e.division = "বিভাগ নির্বাচন করুন।";
  if (!form.district) e.district = "জেলা নির্বাচন করুন।";

  if (form.address_line.trim().length < 10) {
    e.address_line = "সম্পূর্ণ ঠিকানা লিখুন (বাসা/রোড/এলাকা)।";
  } else if (form.address_line.trim().length > 400) {
    e.address_line = "ঠিকানা অনেক বড় হয়ে গেছে।";
  }

  if (form.postcode.trim() && !/^[0-9]{4}$/.test(form.postcode.trim())) {
    e.postcode = "পোস্ট কোড ৪ সংখ্যার হতে হবে।";
  }

  if (!["cod", "bkash", "nagad"].includes(form.payment_method)) {
    e.payment_method = "পেমেন্ট পদ্ধতি নির্বাচন করুন।";
  }

  if (form.payment_method !== "cod") {
    if (form.payment_ref.trim().length < 4) {
      e.payment_ref = "Transaction ID (TrxID) লিখুন।";
    }
    if (form.payment_sender_phone.trim() && !isValidBdPhone(form.payment_sender_phone)) {
      e.payment_sender_phone = "যে নম্বর থেকে পাঠিয়েছেন সেটা ঠিক নয়।";
    }
  }

  if (form.delivery_note.trim().length > 300) {
    e.delivery_note = "নোট অনেক বড় হয়ে গেছে।";
  }

  return e;
}
