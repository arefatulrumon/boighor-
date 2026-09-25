-- =============================================================================
--  0005_storage.sql  —  ছবি রাখার bucket ও তার নিরাপত্তা নীতি
--
--  bucket: book-covers  (পাবলিক পড়া, শুধু staff লিখতে পারবে)
--
--  ফাইল রাখার নিয়ম:
--    book-covers/<book-id>/cover.webp
--    book-covers/<book-id>/gallery-1.webp
--  একই ফোল্ডারে বইয়ের সব ছবি থাকলে পরে ম্যানেজ করা সহজ হয়।
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-covers',
  'book-covers',
  true,                                    -- public: ছবি সবার দেখার জন্য
  5242880,                                 -- ৫ MB সর্বোচ্চ ফাইল সাইজ
  array['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
--  storage.objects এর পলিসি
--  (Storage এর টেবিলেও RLS আছে — নিয়ম টেবিল পলিসির মতোই।)
-- -----------------------------------------------------------------------------

-- পুরনো পলিসি থাকলে মুছে নতুন করে বসানো হয় (idempotent)
drop policy if exists "book_covers_public_read"   on storage.objects;
drop policy if exists "book_covers_staff_insert"  on storage.objects;
drop policy if exists "book_covers_staff_update"  on storage.objects;
drop policy if exists "book_covers_staff_delete"  on storage.objects;

-- যে কেউ ছবি দেখতে পারবে (ওয়েবসাইটে দেখানোর জন্য দরকার)
create policy "book_covers_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'book-covers');

-- শুধু staff নতুন ছবি আপলোড করতে পারবে
create policy "book_covers_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'book-covers' and public.is_staff());

create policy "book_covers_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'book-covers' and public.is_staff())
  with check (bucket_id = 'book-covers' and public.is_staff());

create policy "book_covers_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'book-covers' and public.is_staff());

-- =============================================================================
--  কেন NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY নয়, SUPABASE_SECRET_KEY দিয়েও
--  আপলোড করা যায়?
--
--  ব্রাউজার থেকে আপলোড করলে publishable key + উপরের staff পলিসি — দুটোই
--  যথেষ্ট, এবং এটাই বেশি নিরাপদ (কোনো সার্ভার সিক্রেট লাগে না)।
--
--  `SUPABASE_SECRET_KEY` শুধু তখন দরকার যখন সার্ভার থেকে ব্যাচ আপলোড
--  করতে হয় (যেমন ৫০০ বইয়ের ছবি একবারে)। সেটার জন্য
--  `src/lib/supabase/admin.ts` এর ক্লায়েন্ট ব্যবহার করুন — RLS বাইপাস করে।
--
--  ⚠️ `supabase/README.md` এ আপলোড করার ধাপগুলো লেখা আছে।
-- =============================================================================
