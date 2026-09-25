import { describe, expect, it } from "vitest";
import { parseCsv, rowToObject, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("সাধারণ CSV পড়ে", () => {
    const { headers, rows } = parseCsv("title,price\nবই ক,450\nবই খ,300");
    expect(headers).toEqual(["title", "price"]);
    expect(rows).toEqual([
      ["বই ক", "450"],
      ["বই খ", "300"],
    ]);
  });

  it("কোটেড ফিল্ডের ভেতরের কমা সামলায়", () => {
    const { rows } = parseCsv('title,author\n"বই, দ্বিতীয় খণ্ড",রবীন্দ্রনাথ');
    expect(rows[0][0]).toBe("বই, দ্বিতীয় খণ্ড");
    expect(rows[0][1]).toBe("রবীন্দ্রনাথ");
  });

  it("এস্কেপড ডাবল-কোট (\"\") ঠিকভাবে পড়ে", () => {
    const { rows } = parseCsv('title,publisher\n"দে""জ পাবলিশিং","ক"');
    expect(rows[0][0]).toBe('দে"জ পাবলিশিং');
  });

  it("কোটের ভেতরের নতুন লাইন সামলায়", () => {
    const { rows } = parseCsv('title,desc\n"বই","প্রথম লাইন\nদ্বিতীয় লাইন"');
    expect(rows[0][1]).toBe("প্রথম লাইন\nদ্বিতীয় লাইন");
  });

  it("CRLF (Windows) ঠিকভাবে ভাঙে", () => {
    const { headers, rows } = parseCsv("a,b\r\n১,২\r\n৩,৪");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["১", "২"], ["৩", "৪"]]);
  });

  it("শুরুর BOM সরায়", () => {
    const { headers } = parseCsv("\ufefftitle,price\nবই,450");
    expect(headers[0]).toBe("title");
  });

  it("সেমিকোলন ডিলিমিটারও বুঝে নেয় (Excel কিছু লোকেলে এটা দেয়)", () => {
    const { headers, rows } = parseCsv("title;price\nবই;450");
    expect(headers).toEqual(["title", "price"]);
    expect(rows).toEqual([["বই", "450"]]);
  });

  it("শিরোনাম lowercase ও স্পেসকে _ করে দেয়", () => {
    const { headers } = parseCsv("Title BN,Compare At Price\nক,৫০০");
    expect(headers).toEqual(["title_bn", "compare_at_price"]);
  });

  it("ছোট সারিতে খালি মান জুড়ে দেয়", () => {
    const { headers, rows } = parseCsv("a,b,c\n১,২");
    expect(headers.length).toBe(3);
    expect(rows[0]).toEqual(["১", "২", ""]);
  });

  it("খালি ফাইলে এরর দেয়", () => {
    expect(parseCsv("").errors.length).toBeGreaterThan(0);
    expect(parseCsv("   ").errors.length).toBeGreaterThan(0);
  });

  it("একেবারে শেষের সারিও ধরে (নতুন লাইন ছাড়া)", () => {
    const { rows } = parseCsv("a\n১\n২");
    expect(rows).toEqual([["১"], ["২"]]);
  });
});

describe("rowToObject", () => {
  it("শিরোনাম দিয়ে ম্যাপ বানায় ও ট্রিম করে", () => {
    expect(rowToObject(["a", "b"], ["  ১  ", "২"])).toEqual({ a: "১", b: "২" });
  });

  it("সারিতে কম মান থাকলে খালি স্ট্রিং দেয়", () => {
    expect(rowToObject(["a", "b", "c"], ["১"])).toEqual({ a: "১", b: "", c: "" });
  });
});

describe("toCsv", () => {
  it("সাধারণ মান লিখে", () => {
    expect(toCsv(["a", "b"], [[1, "২"]])).toBe("a,b\r\n1,২");
  });

  it("কমা/কোট/নিউলাইন থাকলে কোটে মুড়ে দেয়", () => {
    expect(toCsv(["x"], [["a,b"]])).toBe('x\r\n"a,b"');
    expect(toCsv(["x"], [['বলল "হ্যাঁ"']])).toBe('x\r\n"বলল ""হ্যাঁ"""');
    expect(toCsv(["x"], [["লাইন\n২"]])).toBe('x\r\n"লাইন\n২"');
  });

  it("null / undefined খালি সেলে পরিণত হয়", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });

  it("bom দিলে শুরুর BOM যোগ হয় (Excel এ বাংলার জন্য দরকার)", () => {
    expect(toCsv(["a"], [["১"]], { bom: true }).startsWith("\ufeff")).toBe(true);
    expect(toCsv(["a"], [["১"]]).startsWith("\ufeff")).toBe(false);
  });
});

describe("parseCsv → toCsv রাউন্ড-ট্রিপ", () => {
  it("জটিল মান লিখে আবার পড়লে একই পাওয়া যায়", () => {
    const original = [
      ["বই, দ্বিতীয় খণ্ড", 'দে"জ', "লাইন\n২"],
      ["সাধারণ", "মান", "৩"],
    ];
    const csv = toCsv(["a", "b", "c"], original);
    const { rows } = parseCsv(csv);
    expect(rows).toEqual(original);
  });
});
