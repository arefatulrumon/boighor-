"use client";

import { useWishlist } from "@/lib/wishlist";
import { cn } from "./ui";

/** বইয়ের কার্ড/পেজে ছোট হার্ট বাটন */
export function WishlistButton({
  bookId,
  className,
  withLabel = false,
}: {
  bookId: string;
  className?: string;
  withLabel?: boolean;
}) {
  const { has, toggle, ready } = useWishlist();
  const active = ready && has(bookId);

  return (
    <button
      type="button"
      onClick={(e) => {
        // কার্ডের ভেতরে থাকলে বাইরের লিংকে ক্লিক যাওয়া আটকাতে হয়
        e.preventDefault();
        e.stopPropagation();
        toggle(bookId);
      }}
      aria-pressed={active}
      aria-label={active ? "ইচ্ছেতালিকা থেকে সরান" : "ইচ্ছেতালিকায় যোগ করুন"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-white/95 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors",
        active
          ? "border-rose-200 text-rose-600"
          : "border-stone-200 text-stone-500 hover:text-rose-600",
        className
      )}
    >
      <span aria-hidden>{active ? "♥" : "♡"}</span>
      {withLabel && <span>{active ? "তালিকায় আছে" : "পরে কিনব"}</span>}
    </button>
  );
}
