-- ============================================================
-- 016: シフト管理テーブル
-- ============================================================

-- 曜日別必要人数（管理者が設定）
CREATE TABLE public.shift_requirements (
  day_of_week  integer PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=日曜, 1=月曜, 2=火曜, 3=水曜, 4=木曜, 5=金曜, 6=土曜
  am_required  integer NOT NULL DEFAULT 1 CHECK (am_required >= 0),
  pm_required  integer NOT NULL DEFAULT 1 CHECK (pm_required >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES public.profiles(id)
);

-- デフォルト値を挿入（月〜土: 各1名、日: 0名）
INSERT INTO public.shift_requirements (day_of_week, am_required, pm_required) VALUES
  (0, 0, 0),
  (1, 1, 1),
  (2, 1, 1),
  (3, 1, 1),
  (4, 1, 1),
  (5, 1, 1),
  (6, 1, 1);

-- 従業員のシフト希望（従業員が月単位で提出）
CREATE TABLE public.shift_preferences (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preference_date date NOT NULL,
  -- full=終日OK, am=午前のみ, pm=午後のみ, off=出勤不可
  preference_type text NOT NULL DEFAULT 'off'
                  CHECK (preference_type IN ('full', 'am', 'pm', 'off')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, preference_date)
);

-- 生成済みシフト（管理者が自動生成 or 手動で作成）
CREATE TABLE public.shifts (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_date  date NOT NULL,
  time_slot   text NOT NULL CHECK (time_slot IN ('AM', 'PM', 'FULL')),
  -- draft=下書き, confirmed=確定
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, shift_date, time_slot)
);

-- RLS 有効化
ALTER TABLE public.shift_requirements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts              ENABLE ROW LEVEL SECURITY;

-- shift_requirements: 全スタッフ読み取り / admin のみ書き込み
CREATE POLICY "staff_read_shift_requirements" ON public.shift_requirements
  FOR SELECT USING (public.is_staff());

CREATE POLICY "admin_write_shift_requirements" ON public.shift_requirements
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- shift_preferences: 全スタッフ読み取り / 自分の行は誰でも書き込み
CREATE POLICY "staff_read_shift_preferences" ON public.shift_preferences
  FOR SELECT USING (public.is_staff());

CREATE POLICY "staff_write_own_shift_preferences" ON public.shift_preferences
  FOR ALL USING (public.is_staff() AND employee_id = auth.uid())
  WITH CHECK (public.is_staff() AND employee_id = auth.uid());

-- shifts: 全スタッフ読み取り / admin のみ書き込み
CREATE POLICY "staff_read_shifts" ON public.shifts
  FOR SELECT USING (public.is_staff());

CREATE POLICY "admin_write_shifts" ON public.shifts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
