import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { getDeliveryZones } from "@/lib/queries";
import { getPublicSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "চেকআউট",
  robots: { index: false, follow: false },
};

// ডেলিভারি চার্জ ও bKash নম্বর যেন ৫ মিনিটের বেশি পুরনো না হয়
export const revalidate = 300;

/**
 * চেকআউট পেজ একটি Server Component — কারণ ডেলিভারি জোন আর সেটিংস
 * সার্ভার থেকেই পড়া দরকার। ফর্মের ইন্টারঅ্যাকশনটুকু
 * <CheckoutForm /> (Client Component) সামলায়।
 */
export default async function CheckoutPage() {
  const [zones, settings] = await Promise.all([
    getDeliveryZones(),
    getPublicSettings(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 text-sm text-stone-600">
        <Link href="/cart" className="hover:text-emerald-800">কার্ট</Link>
        <span className="mx-2 text-stone-400">/</span>
        <span className="text-stone-900">চেকআউট</span>
      </nav>

      <h1 className="mb-8 text-2xl font-bold text-stone-900">অর্ডার সম্পন্ন করুন</h1>

      <CheckoutForm
        zones={zones}
        settings={{
          bkash_number: settings.bkash_number,
          nagad_number: settings.nagad_number,
          payment_instruction: settings.payment_instruction,
          delivery_default_fee: settings.delivery_default_fee,
        }}
      />
    </div>
  );
}
