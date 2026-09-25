import { describe, expect, it } from "vitest";
import { COURIER_TO_ORDER_STATUS, normalizeCourierStatus } from "@/lib/courier/types";

describe("normalizeCourierStatus", () => {
  it("সাধারণ স্টেটাসগুলো চেনে", () => {
    expect(normalizeCourierStatus("pending")).toBe("pending");
    expect(normalizeCourierStatus("in_review")).toBe("in_review");
    expect(normalizeCourierStatus("hold")).toBe("on_hold");
    expect(normalizeCourierStatus("delivered")).toBe("delivered");
    expect(normalizeCourierStatus("cancelled")).toBe("cancelled");
  });

  it("বড় হাতের অক্ষর ও স্পেস/ড্যাশ সামলায়", () => {
    expect(normalizeCourierStatus("IN_TRANSIT")).toBe("in_transit");
    expect(normalizeCourierStatus("In Review")).toBe("in_review");
    expect(normalizeCourierStatus("out-for-delivery")).toBe("out_for_delivery");
    expect(normalizeCourierStatus("  Delivered  ")).toBe("delivered");
  });

  it("_approval_pending ভ্যারিয়েন্টগুলো চেনে", () => {
    expect(normalizeCourierStatus("delivered_approval_pending")).toBe("delivered");
    expect(normalizeCourierStatus("cancelled_approval_pending")).toBe("cancelled");
    expect(normalizeCourierStatus("partial_delivered_approval_pending"))
      .toBe("partial_delivered");
  });

  it("বিকল্প নামগুলো ম্যাপ করে", () => {
    expect(normalizeCourierStatus("picked")).toBe("in_transit");
    expect(normalizeCourierStatus("return")).toBe("returned");
    expect(normalizeCourierStatus("undelivered")).toBe("delivery_failed");
  });

  it("অজানা মানে unknown দেয় (ক্র্যাশ করে না)", () => {
    expect(normalizeCourierStatus("কিছু_নতুন_স্টেটাস")).toBe("unknown");
    expect(normalizeCourierStatus("")).toBe("unknown");
    expect(normalizeCourierStatus(null)).toBe("unknown");
    expect(normalizeCourierStatus(undefined)).toBe("unknown");
  });
});

describe("COURIER_TO_ORDER_STATUS", () => {
  it("ডেলিভারড স্টেটাসে টাকা আদায় হয়েছে ধরে নেয়", () => {
    expect(COURIER_TO_ORDER_STATUS.delivered).toBe("delivered");
    expect(COURIER_TO_ORDER_STATUS.partial_delivered).toBe("delivered");
  });

  it("বাতিল ও ফেরত আলাদা রাখে (স্টক ফেরতের জন্য এটা জরুরি)", () => {
    expect(COURIER_TO_ORDER_STATUS.cancelled).toBe("cancelled");
    expect(COURIER_TO_ORDER_STATUS.returned).toBe("returned");
  });

  it("সিদ্ধান্তহীন স্টেটাসে null দেয় — অর্থাৎ অর্ডার বদলানো হবে না", () => {
    // এই তিনটি ইচ্ছাকৃতভাবে null: হাতে দেখার দরকার, নাহলে ভুল স্টেটাস বসবে
    expect(COURIER_TO_ORDER_STATUS.on_hold).toBeNull();
    expect(COURIER_TO_ORDER_STATUS.delivery_failed).toBeNull();
    expect(COURIER_TO_ORDER_STATUS.unknown).toBeNull();
  });
});
