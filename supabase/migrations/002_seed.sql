-- ============================================================
-- シードデータ（開発・動作確認用）
-- ============================================================
-- 前提: 001_init.sql を実行済みであること
--
-- 実行手順:
-- 1. このファイルの「Step 1: 顧客データ」を実行
-- 2. Supabase Auth から管理者ユーザーを作成し、UUIDでroleをadminに更新
-- 3. 「Step 2: 注文データ」を実行
-- ============================================================


-- ============================================================
-- Step 1: サンプル顧客データ
-- ============================================================
INSERT INTO public.customers (name, phone, email, address, notes) VALUES
  ('株式会社グリーンオフィス', '03-1111-2222', 'green@example.com',
   '東京都千代田区丸の内1-1-1 グリーンビル5F', '毎月第1週に定期注文あり。担当: 佐藤様'),
  ('田中花子', '090-3333-4444', 'tanaka-h@example.com',
   '東京都渋谷区代々木2-2-2', '誕生日（5月15日）に毎年注文'),
  ('山田商店', '03-5555-6666', 'yamada@example.com',
   '東京都新宿区西新宿3-3-3', '開店記念日は8月10日'),
  ('ブルーソレイユ株式会社', '03-7777-8888', 'bluesoleil@example.com',
   '東京都港区芝浦4-4-4 ブルービル2F', '法人契約。請求書払い希望'),
  ('鈴木一郎', '080-9999-0000', NULL,
   '東京都世田谷区5-5-5', NULL);


-- ============================================================
-- Step 2: サンプル注文データ
-- ※ Step 1 の顧客データ挿入後に実行してください
-- ============================================================
INSERT INTO public.orders
  (customer_id, status, delivery_name, delivery_address,
   delivery_date, product_name, quantity, purpose, message_card, remarks)
VALUES
  -- 株式会社グリーンオフィス の注文①
  (
    (SELECT id FROM public.customers WHERE name = '株式会社グリーンオフィス' ORDER BY created_at LIMIT 1),
    '受付',
    '株式会社グリーンオフィス 総務部 御中',
    '東京都千代田区丸の内1-1-1 グリーンビル5F',
    (CURRENT_DATE + INTERVAL '5 days')::date,
    'スタンド花（2段）',
    2,
    '開店祝い',
    '祝 ご開店　貴社のますますのご発展をお祈り申し上げます　グリーンオフィス一同',
    '白・グリーン系でまとめてください'
  ),
  -- 株式会社グリーンオフィス の注文②
  (
    (SELECT id FROM public.customers WHERE name = '株式会社グリーンオフィス' ORDER BY created_at LIMIT 1),
    '制作中',
    '株式会社グリーンオフィス 営業部',
    '東京都千代田区丸の内1-1-1 グリーンビル5F',
    (CURRENT_DATE + INTERVAL '2 days')::date,
    'アレンジメント（M）',
    3,
    '誕生日',
    'Happy Birthday! 佐藤部長へ　営業部一同より',
    NULL
  ),
  -- 田中花子 の注文①
  (
    (SELECT id FROM public.customers WHERE name = '田中花子' ORDER BY created_at LIMIT 1),
    '配達準備中',
    '田中花子',
    '東京都渋谷区代々木2-2-2',
    (CURRENT_DATE + INTERVAL '1 days')::date,
    '花束（季節の花）',
    1,
    '記念日',
    NULL,
    'リボンをピンクにしてください'
  ),
  -- 田中花子 の注文②（完了済み）
  (
    (SELECT id FROM public.customers WHERE name = '田中花子' ORDER BY created_at LIMIT 1),
    '完了',
    '田中花子',
    '東京都渋谷区代々木2-2-2',
    (CURRENT_DATE - INTERVAL '10 days')::date,
    '胡蝶蘭（3本立て）',
    1,
    '開業祝い',
    '祝 ご開業　田中花子',
    NULL
  ),
  -- 山田商店 の注文
  (
    (SELECT id FROM public.customers WHERE name = '山田商店' ORDER BY created_at LIMIT 1),
    '配達済み',
    '山田商店 山田太郎様',
    '東京都新宿区西新宿3-3-3',
    (CURRENT_DATE - INTERVAL '2 days')::date,
    'ウェルカムフラワー',
    1,
    '季節のお飾り',
    NULL,
    NULL
  ),
  -- ブルーソレイユ株式会社 の注文①（キャンセル）
  (
    (SELECT id FROM public.customers WHERE name = 'ブルーソレイユ株式会社' ORDER BY created_at LIMIT 1),
    'キャンセル',
    'ブルーソレイユ株式会社',
    '東京都港区芝浦4-4-4 ブルービル2F',
    (CURRENT_DATE - INTERVAL '5 days')::date,
    'スタンド花（1段）',
    1,
    'お礼',
    NULL,
    '先方都合によりキャンセル'
  ),
  -- ブルーソレイユ株式会社 の注文②
  (
    (SELECT id FROM public.customers WHERE name = 'ブルーソレイユ株式会社' ORDER BY created_at LIMIT 1),
    '受付',
    'ブルーソレイユ株式会社 会議室',
    '東京都港区芝浦4-4-4 ブルービル2F',
    (CURRENT_DATE + INTERVAL '7 days')::date,
    'テーブルフラワー（小）',
    4,
    'その他',
    NULL,
    '会議室4部屋分。高さ20cm以下で'
  );


-- ============================================================
-- Step 3: 管理者のステータス変更履歴サンプル（任意）
-- ※ <ADMIN_UUID> を実際の管理者UUIDに置き換えて実行
-- ============================================================

-- INSERT INTO public.order_status_logs (order_id, old_status, new_status, changed_by, note)
-- SELECT id, NULL, '受付', '<ADMIN_UUID>', '注文受付'
-- FROM public.orders;
