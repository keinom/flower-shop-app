-- ============================================================
-- 017: シフトの時間帯対応
-- ============================================================

-- 1. shift_requirements に AM/PM の時間帯設定を追加
ALTER TABLE public.shift_requirements
  ADD COLUMN IF NOT EXISTS am_start TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS am_end   TEXT NOT NULL DEFAULT '13:00',
  ADD COLUMN IF NOT EXISTS pm_start TEXT NOT NULL DEFAULT '13:00',
  ADD COLUMN IF NOT EXISTS pm_end   TEXT NOT NULL DEFAULT '18:00';

-- 2. shift_preferences に具体的な時刻カラムを追加
ALTER TABLE public.shift_preferences
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time   TEXT;

-- 3. 既存の preference_type データを時刻カラムに移行
UPDATE public.shift_preferences
  SET start_time = '09:00', end_time = '18:00'
  WHERE preference_type = 'full' AND start_time IS NULL;

UPDATE public.shift_preferences
  SET start_time = '09:00', end_time = '13:00'
  WHERE preference_type = 'am' AND start_time IS NULL;

UPDATE public.shift_preferences
  SET start_time = '13:00', end_time = '18:00'
  WHERE preference_type = 'pm' AND start_time IS NULL;

-- 既存データを 'available' に統一
UPDATE public.shift_preferences
  SET preference_type = 'available'
  WHERE preference_type IN ('full', 'am', 'pm');

-- 4. preference_type の CHECK 制約を更新
ALTER TABLE public.shift_preferences
  DROP CONSTRAINT IF EXISTS shift_preferences_preference_type_check;

ALTER TABLE public.shift_preferences
  ADD CONSTRAINT shift_preferences_preference_type_check
  CHECK (preference_type IN ('available', 'off'));

-- 5. shifts テーブルに時刻カラムを追加
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time   TEXT;

-- 6. shifts の time_slot から時刻を補完（既存データ対応）
UPDATE public.shifts s
  SET
    start_time = CASE s.time_slot
      WHEN 'AM'   THEN '09:00'
      WHEN 'PM'   THEN '13:00'
      WHEN 'FULL' THEN '09:00'
    END,
    end_time = CASE s.time_slot
      WHEN 'AM'   THEN '13:00'
      WHEN 'PM'   THEN '18:00'
      WHEN 'FULL' THEN '18:00'
    END
  WHERE s.start_time IS NULL;
