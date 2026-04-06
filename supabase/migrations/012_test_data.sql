-- ============================================================
-- テストデータ（開発・動作確認用）
-- Supabase SQL Editor で実行してください
-- ※ 実行するたびに新しいUUIDで追加されます（冪等ではありません）
-- ============================================================

DO $$
DECLARE
  -- 顧客ID
  cid_marunouchi UUID;
  cid_watanabe   UUID;
  cid_kyoto      UUID;
  cid_kitayama   UUID;
  cid_hakodate   UUID;
  cid_osaka      UUID;
  cid_kyushu     UUID;
  cid_kawaguchi  UUID;

  -- 定期注文テンプレートID
  tid_weekly     UUID;
  tid_monthly_wd UUID;
  tid_monthly_d  UUID;

  -- 注文ID
  oid_01 UUID; oid_02 UUID; oid_03 UUID; oid_04 UUID; oid_05 UUID;
  oid_06 UUID; oid_07 UUID; oid_08 UUID; oid_09 UUID; oid_10 UUID;
  oid_11 UUID; oid_12 UUID; oid_13 UUID; oid_14 UUID; oid_15 UUID;
  oid_16 UUID; oid_17 UUID; oid_18 UUID; oid_19 UUID; oid_20 UUID;
  oid_21 UUID;

BEGIN

  -- ════════════════════════════════════════════════════
  -- 1. 顧客データ（8件）
  -- ════════════════════════════════════════════════════

  INSERT INTO public.customers (name, phone, email, address, notes) VALUES
    ('丸の内フラワーデザイン株式会社', '03-1234-5678', 'info@marunouchi-flower.example.com',
     '東京都千代田区大手町1-2-3 丸の内ビル5F', '法人契約・月末締め請求書払い。担当: 伊藤様')
  RETURNING id INTO cid_marunouchi;

  INSERT INTO public.customers (name, phone, email, address, notes) VALUES
    ('渡辺美穂', '090-2345-6789', 'watanabe.m@example.com',
     '神奈川県横浜市港北区綱島東4-5-6', '誕生日は3月20日。ピンク・白系が好み')
  RETURNING id INTO cid_watanabe;

  INSERT INTO public.customers (name, phone, email, address, notes) VALUES
    ('京都ホテル株式会社', '075-1111-2222', 'flower@kyoto-hotel.example.com',
     '京都府京都市中京区三条通烏丸東入', '毎月定期生け込みあり。ロビー・会議室・廊下。担当: 中村様')
  RETURNING id INTO cid_kyoto;

  INSERT INTO public.customers (name, phone, email, address, notes) VALUES
    ('北山工業株式会社', '052-3333-4444', 'soumu@kitayama-kogyo.example.com',
     '愛知県名古屋市中区丸の内1-2-3 KYビル10F', '新社屋開業祝いの大口注文あり')
  RETURNING id INTO cid_kitayama;

  INSERT INTO public.customers (name, phone, email, address, notes) VALUES
    ('函館の風株式会社', '0138-11-2222', 'info@hakodate-kaze.example.com',
     '北海道函館市元町1-2-3', '毎月15日前後に定期発送。冷涼地のため配送に注意')
  RETURNING id INTO cid_hakodate;

  INSERT INTO public.customers (name, phone, email, address, notes) VALUES
    ('大阪花壇株式会社', '06-5555-6666', 'order@osaka-kadan.example.com',
     '大阪府大阪市北区梅田1-1-1 グランドビル3F', '開業祝いなど大型スタンド花が多い')
  RETURNING id INTO cid_osaka;

  INSERT INTO public.customers (name, phone, email, address, notes) VALUES
    ('九州商事株式会社', '092-7777-8888', 'info@kyushu-shoji.example.com',
     '福岡県福岡市博多区博多駅前1-2-3 博多ビル5F', '季節のギフト発送が多い')
  RETURNING id INTO cid_kyushu;

  INSERT INTO public.customers (name, phone, email, address, notes) VALUES
    ('川口さくら', '048-9999-0000', 'kawaguchi.s@example.com',
     '埼玉県川口市栄町1-2-3', NULL)
  RETURNING id INTO cid_kawaguchi;


  -- ════════════════════════════════════════════════════
  -- 2. 定期注文テンプレート（3件）
  -- ════════════════════════════════════════════════════

  -- 毎週月・木 テーブルフラワー配達（丸の内）
  INSERT INTO public.recurring_order_templates (
    customer_id, title,
    recurrence_type, weekly_days,
    start_date,
    order_type, delivery_name, delivery_address, delivery_phone,
    delivery_time_start, delivery_time_end,
    purpose, is_active, last_generated_date
  ) VALUES (
    cid_marunouchi, '【丸の内】毎週月・木 テーブルフラワー',
    'weekly', ARRAY[1, 4],
    '2026-01-05',
    '配達', '丸の内フラワーデザイン株式会社 受付',
    '東京都千代田区大手町1-2-3 丸の内ビル5F', '03-1234-5678',
    '10:00', '12:00',
    '季節のお飾り', true, '2026-04-03'
  ) RETURNING id INTO tid_weekly;

  INSERT INTO public.recurring_order_template_items
    (template_id, product_name, description, quantity, unit_price, tax_rate)
  VALUES
    (tid_weekly, 'テーブルフラワー（Mサイズ）', '季節の花を使ったアレンジメント', 4, 3000, 10);


  -- 毎月第2火曜日 ロビー生け込み（京都ホテル）
  INSERT INTO public.recurring_order_templates (
    customer_id, title,
    recurrence_type, monthly_week, monthly_weekday,
    start_date,
    order_type, delivery_name, delivery_address, delivery_phone,
    delivery_time_start, delivery_time_end,
    purpose, is_active, last_generated_date
  ) VALUES (
    cid_kyoto, '【京都ホテル】毎月第2火曜 ロビー生け込み',
    'monthly_weekday', 2, 2,
    '2026-01-13',
    '生け込み', '京都ホテル株式会社',
    '京都府京都市中京区三条通烏丸東入', '075-1111-2222',
    '09:00', '10:00',
    '季節のお飾り', true, '2026-04-07'
  ) RETURNING id INTO tid_monthly_wd;

  INSERT INTO public.recurring_order_template_items
    (template_id, product_name, description, quantity, unit_price, tax_rate)
  VALUES
    (tid_monthly_wd, '生け込み（ロビー用）', '高さ80cm以上のダイナミックな構成', 1, 20000, 10),
    (tid_monthly_wd, '生け込み（会議室用）', '卓上サイズ×3か所', 3, 5000, 10);


  -- 毎月15日 定期発送（函館の風）
  INSERT INTO public.recurring_order_templates (
    customer_id, title,
    recurrence_type, monthly_day,
    start_date,
    order_type, delivery_name, delivery_address, delivery_phone,
    purpose, is_active, last_generated_date
  ) VALUES (
    cid_hakodate, '【函館の風】毎月15日 定期発送',
    'monthly_date', 15,
    '2026-01-15',
    '発送', '函館の風株式会社',
    '北海道函館市元町1-2-3', '0138-11-2222',
    '季節のお飾り', true, '2026-03-15'
  ) RETURNING id INTO tid_monthly_d;

  INSERT INTO public.recurring_order_template_items
    (template_id, product_name, description, quantity, unit_price, tax_rate)
  VALUES
    (tid_monthly_d, '胡蝶蘭（白・2本立て）', NULL, 1, 25000, 10),
    (tid_monthly_d, '配送料（ヤマト運輸 100サイズ）', NULL, 1, 2300, 10);


  -- ════════════════════════════════════════════════════
  -- 3. 今日（2026-04-06）の注文 ── 日報に表示される
  -- ════════════════════════════════════════════════════
  -- 配達 × 3、来店 × 2、生け込み × 1、発送 × 3
  -- ステータスも全種カバー

  -- ① 配達 09:30〜11:30 受付完了 → 渡辺美穂（神奈川・配送料あり）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, message_card, total_amount
  ) VALUES (
    cid_watanabe, '受付完了', '配達',
    '渡辺美穂', '神奈川県横浜市港北区綱島東4-5-6', '090-2345-6789',
    '2026-04-06', '09:30', '11:30',
    'バラ花束（赤・15本）', 1, '誕生日',
    'お誕生日おめでとうございます！いつまでもお元気で。',
    9020  -- (7000+1200)*1.1
  ) RETURNING id INTO oid_01;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_01, 'バラ花束（赤・15本）', 'リボン付き・ラッピング込み', 1, 7000, 10),
    (oid_01, '配送料（ヤマト運輸 60サイズ）', NULL, 1, 1200, 10);


  -- ② 配達 13:00〜15:00 作成中 → 丸の内（東京・定期リンク）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, total_amount, recurring_template_id
  ) VALUES (
    cid_marunouchi, '作成中', '配達',
    '丸の内フラワーデザイン株式会社 受付', '東京都千代田区大手町1-2-3 丸の内ビル5F', '03-1234-5678',
    '2026-04-06', '13:00', '15:00',
    NULL, 4, '季節のお飾り', 13200, tid_weekly
  ) RETURNING id INTO oid_02;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_02, 'テーブルフラワー（Mサイズ）', '季節の花を使ったアレンジメント', 4, 3000, 10);


  -- ③ 来店 11:00〜11:30 ラッピング中 → 川口さくら
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, total_amount
  ) VALUES (
    cid_kawaguchi, 'ラッピング中', '来店',
    '川口さくら', '東京都港区南青山7-12-9', '048-9999-0000',
    '2026-04-06', '11:00', '11:30',
    '季節のブーケ', 1, '記念日', 4950  -- 4500*1.1
  ) RETURNING id INTO oid_03;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_03, '季節のブーケ', 'ピンク・白系でまとめて', 1, 4500, 10);


  -- ④ 来店 15:00〜15:30 受付 → 渡辺美穂
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, total_amount
  ) VALUES (
    cid_watanabe, '受付', '来店',
    '渡辺美穂', '東京都港区南青山7-12-9', '090-2345-6789',
    '2026-04-06', '15:00', '15:30',
    'バラ花束（白・10本）', 1, '誕生日', 5500  -- 5000*1.1
  ) RETURNING id INTO oid_04;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_04, 'バラ花束（白・10本）', NULL, 1, 5000, 10);


  -- ⑤ 配達 14:00〜16:00 配達準備完了 → 大阪花壇（大阪）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, message_card, total_amount
  ) VALUES (
    cid_osaka, '配達準備完了', '配達',
    '大阪花壇株式会社 御中', '大阪府大阪市北区梅田1-1-1 グランドビル3F', '06-5555-6666',
    '2026-04-06', '14:00', '16:00',
    'スタンド花（2段）', 1, '開業祝い',
    '祝 ご開業　貴社のますますのご発展をお祈り申し上げます',
    27500  -- 25000*1.1
  ) RETURNING id INTO oid_05;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_05, 'スタンド花（2段）', '白・グリーン系。高さ160cm以上', 1, 25000, 10);


  -- ⑥ 生け込み 09:00〜10:00 配達中 → 京都ホテル（定期リンク）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, total_amount, recurring_template_id
  ) VALUES (
    cid_kyoto, '配達中', '生け込み',
    '京都ホテル株式会社', '京都府京都市中京区三条通烏丸東入', '075-1111-2222',
    '2026-04-06', '09:00', '10:00',
    NULL, 4, '季節のお飾り', 35200,  -- (20000+3*5000)*1.1
    tid_monthly_wd
  ) RETURNING id INTO oid_06;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_06, '生け込み（ロビー用）', '高さ80cm以上のダイナミックな構成', 1, 20000, 10),
    (oid_06, '生け込み（会議室用）', '卓上サイズ×3か所', 3, 5000, 10);


  -- ⑦ 発送 受付 → 函館の風（北海道・定期リンク・配送料あり）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date,
    product_name, quantity, purpose, total_amount, recurring_template_id
  ) VALUES (
    cid_hakodate, '受付', '発送',
    '函館の風株式会社', '北海道函館市元町1-2-3', '0138-11-2222',
    '2026-04-06',
    '胡蝶蘭（白・2本立て）', 1, '季節のお飾り',
    30030,  -- (25000+2300)*1.1 = 27300*1.1
    tid_monthly_d
  ) RETURNING id INTO oid_07;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_07, '胡蝶蘭（白・2本立て）', NULL, 1, 25000, 10),
    (oid_07, '配送料（ヤマト運輸 100サイズ）', NULL, 1, 2300, 10);


  -- ⑧ 発送 受付完了 → 九州商事（福岡・配送料あり）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date,
    product_name, quantity, purpose, total_amount
  ) VALUES (
    cid_kyushu, '受付完了', '発送',
    '九州商事株式会社', '福岡県福岡市博多区博多駅前1-2-3 博多ビル5F', '092-7777-8888',
    '2026-04-06',
    '季節のアレンジ', 1, '誕生日',
    10670  -- (8000+1700)*1.1
  ) RETURNING id INTO oid_08;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_08, '季節のアレンジ', '明るい色調で', 1, 8000, 10),
    (oid_08, '配送料（佐川急便 60サイズ）', NULL, 1, 1700, 10);


  -- ⑨ 発送 受付 → 北山工業（愛知・配送料あり）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date,
    product_name, quantity, purpose, remarks, total_amount
  ) VALUES (
    cid_kitayama, '受付', '発送',
    '北山工業株式会社 総務部', '愛知県名古屋市中区丸の内1-2-3 KYビル10F', '052-3333-4444',
    '2026-04-06',
    'バスケットアレンジ', 1, 'お礼',
    '到着後すぐに飾れるよう水揚げ済みで発送してください',
    15070  -- (12000+1700)*1.1
  ) RETURNING id INTO oid_09;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_09, 'バスケットアレンジ', '春らしいカラフルな構成', 1, 12000, 10),
    (oid_09, '配送料（ヤマト運輸 80サイズ）', NULL, 1, 1700, 10);


  -- ════════════════════════════════════════════════════
  -- 4. 翌日（2026-04-07）の注文
  -- ════════════════════════════════════════════════════

  -- ⑩ 配達 10:00〜12:00 受付 → 京都ホテル（大阪会場）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, message_card, total_amount
  ) VALUES (
    cid_kyoto, '受付', '配達',
    '京都ホテル株式会社 宴会部', '大阪府大阪市北区梅田2-2-2 グランキューブ大阪', '06-1111-2222',
    '2026-04-07', '10:00', '12:00',
    'アレンジメント（Mサイズ）', 1, '記念日',
    '創業記念おめでとうございます。益々のご発展をお祈りしております',
    13200  -- 12000*1.1
  ) RETURNING id INTO oid_10;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_10, 'アレンジメント（Mサイズ）', '洗練されたシンプルなデザイン', 1, 12000, 10);


  -- ⑪ 配達 14:00〜16:00 受付完了 → 丸の内（定期リンク）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, total_amount, recurring_template_id
  ) VALUES (
    cid_marunouchi, '受付完了', '配達',
    '丸の内フラワーデザイン株式会社 受付', '東京都千代田区大手町1-2-3 丸の内ビル5F', '03-1234-5678',
    '2026-04-07', '14:00', '16:00',
    NULL, 4, '季節のお飾り', 13200, tid_weekly
  ) RETURNING id INTO oid_11;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_11, 'テーブルフラワー（Mサイズ）', '季節の花を使ったアレンジメント', 4, 3000, 10);


  -- ⑫ 来店 11:00〜 受付 → 川口さくら（誕生日）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start,
    product_name, quantity, purpose, message_card, total_amount
  ) VALUES (
    cid_kawaguchi, '受付', '来店',
    '川口さくら', '東京都港区南青山7-12-9', '048-9999-0000',
    '2026-04-07', '11:00',
    '誕生日花束', 1, '誕生日',
    'いつもありがとう！Happy Birthday! さくらへ',
    6600  -- 6000*1.1
  ) RETURNING id INTO oid_12;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_12, '誕生日花束', 'カラフルな春の花を束ねて', 1, 6000, 10);


  -- ⑬ 発送 受付 → 函館の風（北海道・定期リンク・配送料あり）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date,
    product_name, quantity, purpose, total_amount, recurring_template_id
  ) VALUES (
    cid_hakodate, '受付', '発送',
    '函館の風株式会社', '北海道函館市元町1-2-3', '0138-11-2222',
    '2026-04-07',
    NULL, 3, '季節のお飾り',
    19910,  -- (2*8000+2100)*1.1 = 18100*1.1
    tid_monthly_d
  ) RETURNING id INTO oid_13;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_13, 'ボックスフラワー', '春のミックスフラワー', 2, 8000, 10),
    (oid_13, '配送料（ヤマト運輸 80サイズ）', NULL, 1, 2100, 10);


  -- ════════════════════════════════════════════════════
  -- 5. 近日・将来の注文
  -- ════════════════════════════════════════════════════

  -- ⑭ 配達 2026-04-10 10:00〜12:00 受付 → 渡辺（神奈川・結婚祝い）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, message_card, remarks, total_amount
  ) VALUES (
    cid_watanabe, '受付', '配達',
    '渡辺様 新居', '神奈川県横浜市港北区新吉田町1234', '090-2345-6789',
    '2026-04-10', '10:00', '12:00',
    '結婚祝い花束', 1, '結婚祝い',
    'ご結婚おめでとうございます！お二人の幸せを心よりお祈り申し上げます',
    '玄関先へお願いします。不在の場合は管理人室へ',
    22000  -- 20000*1.1
  ) RETURNING id INTO oid_14;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_14, '結婚祝い花束', 'ホワイト・クリーム系 高さ60cm', 1, 20000, 10);


  -- ⑮ 生け込み 2026-04-15 09:00〜10:00 受付 → 京都ホテル（定期リンク）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, total_amount, recurring_template_id
  ) VALUES (
    cid_kyoto, '受付', '生け込み',
    '京都ホテル株式会社', '京都府京都市中京区三条通烏丸東入', '075-1111-2222',
    '2026-04-15', '09:00', '10:00',
    NULL, 4, '季節のお飾り', 35200, tid_monthly_wd
  ) RETURNING id INTO oid_15;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_15, '生け込み（ロビー用）', '春の花材をメインに', 1, 20000, 10),
    (oid_15, '生け込み（会議室用）', '卓上サイズ×3か所', 3, 5000, 10);


  -- ⑯ 配達 2026-04-20 受付完了 → 北山工業（愛知・大口開業祝い）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date,
    product_name, quantity, purpose, message_card, remarks, total_amount
  ) VALUES (
    cid_kitayama, '受付完了', '配達',
    '北山工業株式会社 新社屋', '愛知県名古屋市中区丸の内1-2-3 KYビル10F', '052-3333-4444',
    '2026-04-20',
    NULL, 3, '開業祝い',
    '祝 新社屋開業　北山工業株式会社のますますのご発展をお祈り申し上げます',
    'エントランス・会議室・役員室の3か所分。午前中配達希望',
    93500  -- (25000*2+35000)*1.1 = 85000*1.1
  ) RETURNING id INTO oid_16;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_16, 'スタンド花（2段）', 'エントランス用・白グリーン系', 2, 25000, 10),
    (oid_16, 'スタンド花（3段）', '役員室用・豪華仕様', 1, 35000, 10);


  -- ════════════════════════════════════════════════════
  -- 6. 過去の完了・キャンセル注文
  -- ════════════════════════════════════════════════════

  -- ⑰ 配達完了 2026-04-01 → 北山工業（愛知・発送・配送料あり）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, total_amount
  ) VALUES (
    cid_kitayama, '配達完了', '発送',
    '北山工業株式会社', '愛知県名古屋市中区丸の内1-2-3 KYビル10F', '052-3333-4444',
    '2026-04-01', '10:00', '12:00',
    'お祝い花束', 1, 'お礼',
    10670  -- (8000+1700)*1.1
  ) RETURNING id INTO oid_17;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_17, 'お祝い花束', '明るい黄・オレンジ系', 1, 8000, 10),
    (oid_17, '配送料（ヤマト運輸 80サイズ）', NULL, 1, 1700, 10);


  -- ⑱ 配達完了 2026-04-02 → 渡辺美穂（神奈川）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date,
    product_name, quantity, purpose, total_amount
  ) VALUES (
    cid_watanabe, '配達完了', '配達',
    '渡辺美穂', '神奈川県横浜市港北区綱島東4-5-6', '090-2345-6789',
    '2026-04-02',
    'アレンジメント（Sサイズ）', 1, 'お礼', 6600  -- 6000*1.1
  ) RETURNING id INTO oid_18;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_18, 'アレンジメント（Sサイズ）', 'パステルカラーで可愛らしく', 1, 6000, 10);


  -- ⑲ 配達完了 2026-04-03 → 丸の内（東京・定期リンク・配送料あり）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date, delivery_time_start, delivery_time_end,
    product_name, quantity, purpose, total_amount, recurring_template_id
  ) VALUES (
    cid_marunouchi, '配達完了', '配達',
    '丸の内フラワーデザイン株式会社 受付', '東京都千代田区大手町1-2-3 丸の内ビル5F', '03-1234-5678',
    '2026-04-03', '10:00', '12:00',
    NULL, 5, '季節のお飾り',
    14410,  -- (4*3000+1100)*1.1 = 13100*1.1
    tid_weekly
  ) RETURNING id INTO oid_19;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_19, 'テーブルフラワー（Mサイズ）', '春の花を使ったアレンジメント', 4, 3000, 10),
    (oid_19, '配送料（ヤマト運輸 60サイズ）', NULL, 1, 1100, 10);


  -- ⑳ キャンセル 2026-04-04 → 大阪花壇（発送）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date,
    product_name, quantity, purpose, remarks, total_amount
  ) VALUES (
    cid_osaka, 'キャンセル', '発送',
    '大阪花壇株式会社', '大阪府大阪市北区梅田1-1-1 グランドビル3F', '06-5555-6666',
    '2026-04-04',
    'バラ花束（赤・10本）', 1, 'お礼',
    '先方都合によりキャンセル',
    5500  -- 5000*1.1
  ) RETURNING id INTO oid_20;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_20, 'バラ花束（赤・10本）', NULL, 1, 5000, 10);


  -- ㉑ 受付完了 2026-04-08 → 北山工業（愛知・発送・配送料あり）
  INSERT INTO public.orders (
    customer_id, status, order_type,
    delivery_name, delivery_address, delivery_phone,
    delivery_date,
    product_name, quantity, purpose, message_card, total_amount
  ) VALUES (
    cid_kitayama, '受付完了', '発送',
    '北山工業株式会社 総務部', '愛知県名古屋市中区丸の内1-2-3 KYビル10F', '052-3333-4444',
    '2026-04-08',
    '胡蝶蘭（白・3本立て）', 1, '開業祝い',
    '祝 ご開業　今後のご発展を心よりお祈り申し上げます',
    29150  -- (25000+1500)*1.1 = 26500*1.1
  ) RETURNING id INTO oid_21;

  INSERT INTO public.order_items (order_id, product_name, description, quantity, unit_price, tax_rate) VALUES
    (oid_21, '胡蝶蘭（白・3本立て）', NULL, 1, 25000, 10),
    (oid_21, '配送料（ヤマト運輸 60サイズ）', NULL, 1, 1500, 10);


  RAISE NOTICE '✅ テストデータの挿入が完了しました';
  RAISE NOTICE '  顧客: 8件';
  RAISE NOTICE '  定期注文テンプレート: 3件';
  RAISE NOTICE '  注文: 21件（今日9件・明日4件・将来3件・過去5件）';
  RAISE NOTICE '  注文明細: 約35件';

END $$;
