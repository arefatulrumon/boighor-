const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** 1234 → "১২৩৪" */
export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/**
 * টাকার ফরম্যাট।
 *   formatTaka(1250)                    → "১,২৫০ টাকা"  (ডিফল্ট: বাংলা সংখ্যা)
 *   formatTaka(1250, { symbol: true })  → "৳১,২৫০"
 *   formatTaka(1250, { bangla: false }) → "1,250 টাকা"
 */
export function formatTaka(
  amount: number | string | null | undefined,
  options: { bangla?: boolean; symbol?: boolean } = {}
): string {
  const { bangla = true, symbol = false } = options;

  // ⚠️ ব্যর্থ হওয়ার পথেও অপশনগুলো মানতে হবে — নাহলে formatTaka(null)
  //    ফরম্যাটে ভিন্ন ফল দিত (৳০ বনাম ০ টাকা) এবং UI অসামঞ্জস্যপূর্ণ হতো।
  const render = (formatted: string): string => {
    const digits = bangla ? toBanglaDigits(formatted) : formatted;
    return symbol ? `৳${digits}` : `${digits} টাকা`;
  };

  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return render("0");

  // দশমিক থাকলে দেখাও, না থাকলে লুকাও (৳৪৫০ দেখতে ভালো লাগে, ৳৪৫০.০০ নয়)
  const hasFraction = Math.abs(n % 1) > 0.004;
  const formatted = n.toLocaleString("en-IN", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return render(formatted);
}

/** ISO তারিখ → "২৪ সেপ্টেম্বর, ২০২৬" */
const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

export function formatDateBn(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${toBanglaDigits(get("day"))} ${BN_MONTHS[Number(get("month")) - 1]}, ${toBanglaDigits(get("year"))}`;
}

/** ISO তারিখ → "২৪/০৯/২০২৬, ৩:৪৫ PM" */
export function formatDateTimeBn(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";

  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d);

  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);

  return `${toBanglaDigits(date)}, ${toBanglaDigits(time.replace(/\s?(AM|PM)/, ""))} ${time.includes("PM") ? "PM" : "AM"}`;
}

/** ছাড়ের শতাংশ: compare_at_price → price */
export function discountPercent(
  price: number,
  compareAt: number | null | undefined
): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** স্টকের অবস্থা — UI এ রঙ/লেবেল ঠিক করতে */
export function stockState(
  stockQty: number,
  lowThreshold = 3
): { label: string | null; tone: "ok" | "low" | "out" } {
  if (stockQty <= 0) return { label: "স্টক শেষ", tone: "out" };
  if (stockQty <= lowThreshold) return { label: `মাত্র ${toBanglaDigits(stockQty)} কপি বাকি`, tone: "low" };
  return { label: null, tone: "ok" };
}

/** পাঠানোর আগে ইনপুট পরিষ্কার করা (XSS নয় — React নিজেই escape করে) */
export function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** অর্ডার আইডি ছোট করে দেখানো */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
