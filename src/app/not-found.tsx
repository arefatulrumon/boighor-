import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="text-5xl" aria-hidden>📭</p>
      <h1 className="mt-4 text-2xl font-bold text-stone-900">পেজটি খুঁজে পাওয়া যায়নি</h1>
      <p className="mt-2 text-sm text-stone-600">
        আপনি যে পেজ বা বইটি খুঁজছেন সেটি নেই, অথবা সরিয়ে ফেলা হয়েছে।
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">হোমপেজে যান</ButtonLink>
        <ButtonLink href="/books" variant="outline">সব বই দেখুন</ButtonLink>
      </div>
    </div>
  );
}
