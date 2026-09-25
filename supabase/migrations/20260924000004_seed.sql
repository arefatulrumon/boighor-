-- =============================================================================
--  0004_seed.sql  —  শুরুর ডেটা
--  এটা idempotent — কয়বার চালালেও ডুপ্লিকেট হবে না (on conflict)।
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ক্যাটাগরি
-- -----------------------------------------------------------------------------
insert into public.categories (slug, name_bn, name_en, icon, sort_order) values
  ('fiction',           'উপন্যাস',          'Fiction',            '📖', 10),
  ('stories',           'গল্পগ্রন্থ',        'Short Stories',      '📕', 20),
  ('poetry',            'কবিতা',            'Poetry',             '🪶', 30),
  ('science-fiction',   'সায়েন্স ফিকশন',    'Science Fiction',    '🚀', 40),
  ('thriller',          'থ্রিলার ও রহস্য',   'Thriller & Mystery', '🔍', 50),
  ('history',           'ইতিহাস',           'History',            '🏛️', 60),
  ('science',           'বিজ্ঞান',          'Science',            '🔬', 70),
  ('philosophy',        'দর্শন',            'Philosophy',         '💭', 80),
  ('religion',          'ধর্ম ও আধ্যাত্মিক', 'Religion',           '🕌', 90),
  ('biography',         'জীবনী ও স্মৃতিকথা', 'Biography',          '👤', 100),
  ('self-help',         'আত্মউন্নয়ন',       'Self Help',          '🌱', 110),
  ('business',          'ব্যবসা ও অর্থনীতি', 'Business',           '📈', 120),
  ('children',          'শিশু-কিশোর',       'Children',           '🧸', 130),
  ('academic',          'একাডেমিক ও পাঠ্য',  'Academic',           '🎓', 140),
  ('translated',        'অনুবাদ সাহিত্য',    'Translated',         '🌍', 150)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- ডেলিভারি চার্জ (বিভাগভিত্তিক)
-- ⚠️ এগুলো শুরুর ডিফল্ট। আপনার আসল কুরিয়ার রেট অনুযায়ী অ্যাডমিন প্যানেল বা
--    SQL Editor থেকে বদলে নিন।
-- -----------------------------------------------------------------------------
insert into public.delivery_zones
  (division, name_bn, fee, free_above, cod_available, eta_days_min, eta_days_max, sort_order) values
  ('ঢাকা',       'ঢাকা সিটি',            60,  1000, true, 1, 2, 10),
  ('চট্টগ্রাম',  'চট্টগ্রাম',            120, 1500, true, 2, 4, 20),
  ('খুলনা',      'খুলনা',               120, 1500, true, 2, 4, 30),
  ('রাজশাহী',    'রাজশাহী',             120, 1500, true, 2, 4, 40),
  ('সিলেট',      'সিলেট',               130, 1500, true, 2, 5, 50),
  ('বরিশাল',     'বরিশাল',              130, 1500, true, 2, 5, 60),
  ('রংপুর',      'রংপুর',               130, 1500, true, 3, 5, 70),
  ('ময়মনসিংহ',   'ময়মনসিংহ',            120, 1500, true, 2, 4, 80)
on conflict (division) do nothing;

-- -----------------------------------------------------------------------------
-- সাইট সেটিংস
--   is_public = true  →  ওয়েবসাইট থেকে পড়া যাবে (RLS অনুমতি দেয়)
--   is_public = false →  শুধু অ্যাডমিন প্যানেল
-- -----------------------------------------------------------------------------
insert into public.site_settings (key, value, is_public, label_bn) values
  ('store_name',           '"বইঘর"'::jsonb,                          true,  'দোকানের নাম'),
  ('store_tagline',        '"বাংলা বইয়ের বিশ্বস্ত ঠিকানা"'::jsonb,    true,  'ট্যাগলাইন'),
  ('contact_phone',        '"01700000000"'::jsonb,                    true,  'যোগাযোগের ফোন'),
  ('contact_email',        '"hello@example.com"'::jsonb,              true,  'ইমেইল'),
  ('contact_address',      '"ঢাকা, বাংলাদেশ"'::jsonb,                 true,  'ঠিকানা'),
  ('facebook_url',         '""'::jsonb,                               true,  'Facebook পেজ'),
  ('delivery_default_fee', '120'::jsonb,                              false, 'ডিফল্ট ডেলিভারি চার্জ'),
  ('free_delivery_note',   '"১০০০ টাকার উপরে ঢাকায় ফ্রি ডেলিভারি"'::jsonb, true, 'ফ্রি ডেলিভারি নোট'),

  -- ম্যানুয়াল পেমেন্টের তথ্য — চেকআউট পেজে দেখানো হয়
  ('bkash_number',         '"01700000000"'::jsonb,                    true,  'bKash নম্বর (Personal)'),
  ('nagad_number',         '"01700000000"'::jsonb,                    true,  'Nagad নম্বর (Personal)'),
  ('payment_instruction',  '"Send Money করুন উপরের নম্বরে, তারপর Transaction ID নিচে লিখুন।"'::jsonb,
                                                                      true,  'পেমেন্ট নির্দেশনা'),

  -- হোমপেজের ব্যানার
  ('hero_title',           '"বাংলার সেরা বই, এক ক্লিকেই"'::jsonb,      true,  'হিরো টাইটেল'),
  ('hero_subtitle',        '"দেশজুড়ে ক্যাশ অন ডেলিভারি — বই হাতে পেয়ে টাকা দিন"'::jsonb,
                                                                      true,  'হিরো সাবটাইটেল'),

  -- অর্ডার নিয়ে সতর্কবার্তা
  ('announcement',         '""'::jsonb,                               true,  'ঘোষণা বার (খালি = লুকানো)'),
  ('orders_paused',        'false'::jsonb,                            false, 'অর্ডার বন্ধ (true = বন্ধ)')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- ডেমো কুপন (প্রোডাকশনে যাওয়ার আগে মুছে ফেলুন বা is_active = false করুন)
-- -----------------------------------------------------------------------------
insert into public.coupons
  (code, description_bn, discount_type, discount_value, min_order, max_discount, usage_limit, ends_at) values
  ('WELCOME10', 'প্রথম অর্ডারে ১০% ছাড়',        'percent', 10, 500,  100, 500, '2027-12-31'::timestamptz),
  ('BOIMELA50', '৫০ টাকা ছাড়, ৮০০ টাকার উপরে', 'fixed',   50, 800, null, 200, '2027-12-31'::timestamptz)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- ডেমো বই (৫টি) — আপনার আসল বই যোগ করার আগে এগুলো দেখে ফরম্যাট বুঝে নিন।
-- মুছতে:  delete from public.books where slug like 'demo-%';
-- -----------------------------------------------------------------------------
insert into public.books (
  slug, title_bn, title_en, author, publisher, language, binding, pages, publication_year,
  description_bn, price, compare_at_price, stock_qty, category_id, is_featured, is_active
) values
  ('demo-pather-panchali',
   'পথের পাঁচালী', 'Pather Panchali', 'বিভূতিভূষণ বন্দ্যোপাধ্যায়', 'আনন্দ পাবলিশার্স',
   'bangla', 'hardcover', 288, 1929,
   'বাংলা সাহিত্যের অন্যতম শ্রেষ্ঠ উপন্যাস। অপু ও দুর্গার চোখ দিয়ে গ্রামবাংলার জীবন, দারিদ্র্য আর শৈশবের নিখুঁত আঁকিবুঁকি।',
   450.00, 550.00, 25, (select id from public.categories where slug = 'fiction'), true, true),

  ('demo-devdas',
   'দেবদাস', 'Devdas', 'শরৎচন্দ্র চট্টোপাধ্যায়', 'দে''জ পাবলিশিং',
   'bangla', 'paperback', 144, 1917,
   'অমর প্রেমের কাহিনি। পার্বতী আর চন্দ্রমুখীর মাঝখানে দাঁড়িয়ে থাকা দেবদাসের করুণ পরিণতি।',
   280.00, 320.00, 40, (select id from public.categories where slug = 'fiction'), true, true),

  ('demo-shesher-kobita',
   'শেষের কবিতা', 'Shesher Kabita', 'রবীন্দ্রনাথ ঠাকুর', 'বিশ্বভারতী',
   'bangla', 'paperback', 176, 1929,
   'অমিত রায় আর লাবণ্যের বুদ্ধিবৃত্তিক ও রোমান্টিক সম্পর্কের গল্প — রবীন্দ্রনাথের অন্যতম আধুনিক উপন্যাস।',
   320.00, null, 30, (select id from public.categories where slug = 'fiction'), true, true),

  ('demo-sananda',
   'সনন্দ', 'Sananda', 'হুমায়ূন আহমেদ', 'অন্যপ্রকাশ',
   'bangla', 'paperback', 96, 2010,
   'হুমায়ূন আহমেদের অনবদ্য গল্পগ্রন্থ। সহজ ভাষায় জীবনের ছোট ছোট মুহূর্তের গভীরতা।',
   200.00, 250.00, 12, (select id from public.categories where slug = 'stories'), false, true),

  ('demo-bangla-science',
   'বিজ্ঞানের বিস্ময়', 'Wonders of Science', 'মুহম্মদ জাফর ইকবাল', 'সময় প্রকাশন',
   'bangla', 'paperback', 208, 2019,
   'কিশোর-কিশোরীদের জন্য সহজ ভাষায় বিজ্ঞানের মজার দুনিয়া — মহাকাশ থেকে কোয়ান্টাম পর্যন্ত।',
   260.00, 300.00, 3, (select id from public.categories where slug = 'science'), false, true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- পরের ধাপ: অ্যাডমিন অ্যাকাউন্ট তৈরি করা
--
-- ১) Supabase Dashboard → Authentication → Users → "Add user"
--    ইমেইল ও পাসওয়ার্ড দিন, "Auto Confirm User" টিক দিন।
-- ২) তারপর SQL Editor এ চালান:
--
--    insert into public.staff (user_id, full_name, role)
--    select id, 'Arefatul', 'admin'
--    from auth.users where email = 'your-email@example.com';
--
-- ৩) এই ইমেইল দিয়ে /login পেজে সাইন ইন করলে /admin এ ঢুকতে পারবেন।
-- -----------------------------------------------------------------------------
