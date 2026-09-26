import Link from "next/link";
import { Container } from "./ui";

export interface FooterInfo {
  storeName: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  facebookUrl?: string;
}

/**
 * ফুটার — গাঢ় সবুজ (brand-950), তাই সাইটের বাকি অংশের সাথে স্পষ্ট বিরতি।
 *
 * ⚠️ এখানে "পেমেন্ট পদ্ধতি" লেখাটি হার্ডকোড করা — কারণ এটা দোকানের
 *    প্রকৃত নীতি (COD + bKash + Nagad), কোনো সেটিং নয়। নীতি বদলালে
 *    এই লাইনটাও বদলাতে হবে।
 */
export function SiteFooter({ info }: { info: FooterInfo }) {
  const year = new Date().getFullYear();

  return (
    <footer className="no-print mt-20 bg-brand-950 text-brand-100">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display flex items-center gap-2 text-xl text-white">
            <span aria-hidden>📚</span> {info.storeName}
          </p>
          {info.tagline && (
            <p className="prose-bn mt-3 text-sm text-brand-100/75">{info.tagline}</p>
          )}

          {/* পেমেন্ট ব্যাজ — এই তিনটাই আসলে চলে */}
          <ul className="mt-5 flex flex-wrap gap-2">
            {["ক্যাশ অন ডেলিভারি", "bKash", "Nagad"].map((p) => (
              <li
                key={p}
                className="rounded-full border border-brand-100/20 bg-white/5 px-3 py-1 text-xs text-brand-50"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">কেনাকাটা</p>
          <ul className="space-y-2.5 text-sm text-brand-100/75">
            <li><Link href="/books" className="transition-colors hover:text-white">সব বই</Link></li>
            <li><Link href="/books?sort=popular" className="transition-colors hover:text-white">জনপ্রিয় বই</Link></li>
            <li><Link href="/track" className="transition-colors hover:text-white">অর্ডার ট্র্যাক করুন</Link></li>
            <li><Link href="/cart" className="transition-colors hover:text-white">আমার কার্ট</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">সহায়তা</p>
          <ul className="space-y-2.5 text-sm text-brand-100/75">
            <li><Link href="/pages/delivery" className="transition-colors hover:text-white">ডেলিভারি তথ্য</Link></li>
            <li><Link href="/pages/return" className="transition-colors hover:text-white">ফেরত ও রিফান্ড</Link></li>
            <li><Link href="/pages/privacy" className="transition-colors hover:text-white">প্রাইভেসি পলিসি</Link></li>
            <li><Link href="/pages/terms" className="transition-colors hover:text-white">শর্তাবলী</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-white">যোগাযোগ</p>
          <ul className="space-y-2.5 text-sm text-brand-100/75">
            {info.phone && (
              <li>
                📞{" "}
                <a href={`tel:${info.phone}`} className="tabular transition-colors hover:text-white">
                  {info.phone}
                </a>
              </li>
            )}
            {info.email && (
              <li>
                ✉️{" "}
                <a href={`mailto:${info.email}`} className="transition-colors hover:text-white">
                  {info.email}
                </a>
              </li>
            )}
            {info.address && <li className="prose-bn">📍 {info.address}</li>}
            {info.facebookUrl && (
              <li>
                <a
                  href={info.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  Facebook পেজ
                </a>
              </li>
            )}
          </ul>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-brand-100/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {year} {info.storeName}। সর্বস্বত্ব সংরক্ষিত।
          </p>
          <p className="flex flex-wrap items-center gap-3">
            <span>পেমেন্ট: ক্যাশ অন ডেলিভারি · bKash · Nagad</span>
            <Link href="/login" className="transition-colors hover:text-white">
              অ্যাডমিন
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
