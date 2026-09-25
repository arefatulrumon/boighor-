import Link from "next/link";

export interface FooterInfo {
  storeName: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  facebookUrl?: string;
}

export function SiteFooter({ info }: { info: FooterInfo }) {
  const year = new Date().getFullYear();

  return (
    <footer className="no-print mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="flex items-center gap-2 text-lg font-bold text-emerald-900">
            <span>📚</span> {info.storeName}
          </p>
          {info.tagline && (
            <p className="prose-bn mt-2 text-sm text-stone-600">{info.tagline}</p>
          )}
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-stone-900">কেনাকাটা</p>
          <ul className="space-y-2 text-sm text-stone-600">
            <li><Link href="/books" className="hover:text-emerald-800">সব বই</Link></li>
            <li><Link href="/books?sort=popular" className="hover:text-emerald-800">জনপ্রিয় বই</Link></li>
            <li><Link href="/track" className="hover:text-emerald-800">অর্ডার ট্র্যাক করুন</Link></li>
            <li><Link href="/cart" className="hover:text-emerald-800">আমার কার্ট</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-stone-900">সহায়তা</p>
          <ul className="space-y-2 text-sm text-stone-600">
            <li><Link href="/pages/delivery" className="hover:text-emerald-800">ডেলিভারি তথ্য</Link></li>
            <li><Link href="/pages/return" className="hover:text-emerald-800">ফেরত ও রিফান্ড</Link></li>
            <li><Link href="/pages/privacy" className="hover:text-emerald-800">প্রাইভেসি পলিসি</Link></li>
            <li><Link href="/pages/terms" className="hover:text-emerald-800">শর্তাবলী</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-stone-900">যোগাযোগ</p>
          <ul className="space-y-2 text-sm text-stone-600">
            {info.phone && (
              <li>
                📞{" "}
                <a href={`tel:${info.phone}`} className="hover:text-emerald-800">
                  {info.phone}
                </a>
              </li>
            )}
            {info.email && (
              <li>
                ✉️{" "}
                <a href={`mailto:${info.email}`} className="hover:text-emerald-800">
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
                  className="hover:text-emerald-800"
                >
                  Facebook পেজ
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {info.storeName}। সর্বস্বত্ব সংরক্ষিত।
          </p>
          <p className="flex flex-wrap items-center gap-3">
            <span>পেমেন্ট: ক্যাশ অন ডেলিভারি · bKash · Nagad</span>
            <Link href="/login" className="hover:text-emerald-800">
              অ্যাডমিন
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
