-- =====================================================
-- 018_fuda_documents.sql
-- 立て札PDF管理 (Supabase Storage + OCR)
-- =====================================================

-- ── ストレージバケット作成 ──────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fuda-pdfs',
  'fuda-pdfs',
  false,
  10485760,  -- 10MB
  array['application/pdf']
)
on conflict (id) do nothing;

-- ストレージ RLS: admin/employee アップロード
create policy "fuda-pdfs: staff upload"
  on storage.objects for insert
  with check (
    bucket_id = 'fuda-pdfs'
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'employee')
    )
  );

-- ストレージ RLS: admin/employee ダウンロード・閲覧
create policy "fuda-pdfs: staff select"
  on storage.objects for select
  using (
    bucket_id = 'fuda-pdfs'
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'employee')
    )
  );

-- ストレージ RLS: admin のみ削除
create policy "fuda-pdfs: admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'fuda-pdfs'
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

-- ── fuda_documents テーブル ────────────────────────
create table if not exists fuda_documents (
  id             uuid        primary key default gen_random_uuid(),
  file_name      text        not null,
  storage_path   text        not null unique,

  -- Gemini OCR 結果
  occasion       text,                    -- 用途（祝開店・御就任など）
  recipient      text,                    -- 宛名（○○様）
  sender         text,                    -- 差出人（nullあり）
  all_text       text,                    -- 全テキスト（検索用）
  ocr_raw        jsonb,                   -- Gemini 生レスポンス
  ocr_confidence text        check (ocr_confidence in ('high', 'medium', 'low')),
  ocr_done       boolean     not null default false,
  ocr_error      text,

  created_by     uuid        references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────
alter table fuda_documents enable row level security;

create policy "fuda_documents: staff select"
  on fuda_documents for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'employee')
    )
  );

create policy "fuda_documents: staff insert"
  on fuda_documents for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'employee')
    )
  );

create policy "fuda_documents: staff update"
  on fuda_documents for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'employee')
    )
  );

create policy "fuda_documents: admin delete"
  on fuda_documents for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

-- ── インデックス ────────────────────────────────────
create index if not exists fuda_documents_recipient_idx  on fuda_documents (recipient);
create index if not exists fuda_documents_sender_idx     on fuda_documents (sender);
create index if not exists fuda_documents_occasion_idx   on fuda_documents (occasion);
create index if not exists fuda_documents_created_at_idx on fuda_documents (created_at desc);
