import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="flex max-w-xl flex-col items-center py-24 text-center sm:py-32">
      <p className="text-6xl" aria-hidden>
        📭
      </p>
      <h1 className="font-display mt-6 text-3xl text-stone-900">
        পেজটি খুঁজে পাওয়া যায়নি
      </h1>
      <p className="prose-bn mt-3 text-sm text-stone-600">
        আপনি যে পেজ বা বইটি খুঁজছেন সেটি নেই, অথবা সরিয়ে ফেলা হয়েছে।
        হয়তো বইটি আর পাওয়া যাচ্ছে না — একবার তালিকা থেকে দেখে নিন।
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">হোমপেজে যান</ButtonLink>
        <ButtonLink href="/books" variant="outline">
          সব বই দেখুন
        </ButtonLink>
      </div>
    </Container>
  );
}
