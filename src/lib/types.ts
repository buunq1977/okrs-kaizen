/** Ô tick: S M A R T, cộng KRO (tiêu điểm: các KR đạt thì O đạt?) và NEXT (hành động: đưa được vào OKR kỳ tới). */
export type Smart = Record<string, boolean | undefined>

/* ---------- Tầng trên O năm (§17 D1) ---------- */
export interface Vision {
  id: string
  title: string
  target_value: number
  unit: string
  target_year: number
}
export type GoalStatus = 'active' | 'paused' | 'dropped' | 'done'
export interface Goal {
  id: string
  vision_id: string | null
  title: string
  baseline: number
  target: number
  current: number
  unit: string
  deadline: string
  status: GoalStatus
  drop_reason: string | null
  created_at: string
}
export interface Metric {
  id: string
  goal_id: string
  name: string
  unit: string
  kind: 'leading' | 'lagging'
}

/* ---------- OKR + Kaizen ---------- */
export type PeriodKind = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'kickoff'
export type Area = 'cv_tc' | 'mqh' | 'ttt'

export interface Lesson {
  id: string
  text: string
  keyword: string
  signal: string
}
export interface JournalRow {
  id: string
  time: string
  did: string
  result: string
}
/** Kaizen số liệu Tháng/Quý/Năm (§11) — lưu chung trong periods.kaizen */
export interface Diagnosis {
  group: 'a' | 'b' | 'c' | 'd'
  evidence: string
}
export interface Decision {
  decision: 'keep' | 'increase' | 'cut' | 'change' | 'stop'
  reason: string
  at: string
  week?: string
}
export interface KaizenData {
  diagnoses?: Record<string, Diagnosis>
  decisions?: Record<string, Decision>
  num_lessons?: { id: string; text: string; number: string }[]
  skip_reason?: string
  assessment?: string
  journal?: JournalRow[]
  causes?: string
  keywords?: string[]
  lessons?: Lesson[]
  satisfied?: boolean
  consult_who?: string
}
export interface Unlock {
  at: string
  reason: string
}

export interface Period {
  id: string
  kind: PeriodKind
  start_date: string
  status: 'draft' | 'locked'
  locked_at: string | null
  lock_reason: string | null
  unlocks: Unlock[]
  end_date: string | null
  no_fixed_schedule: boolean
  kaizen: KaizenData
  projects?: { id: string; title: string }[]
}

export interface Objective {
  id: string
  period_id: string
  area: Area | null
  title: string
  smart: Smart
  o_metric: string
  o_target: number | null
  o_actual: number | null
  o_result: 'dat' | 'mot_phan' | 'chua' | null
  serves_kr_id: string | null
  serves_ka_id: string | null
  contributes_kr_id: string | null
  weekly_target: number | null
  weekly_actual: number | null
  passive: boolean
  sort: number
}

export interface KR {
  id: string
  period_id: string
  objective_id: string | null
  title: string
  metric: string
  smart: Smart
  weight: number | null
  pct_override: number | null
  override_reason: string | null
  from_action_id: string | null
  sort: number
  kind?: 'tick' | 'numeric'
  parent_kr_id?: string | null
  baseline?: number | null
  target?: number | null
  unit?: string
  deadline?: string | null
  source?: string
  leading_ind?: Leading[]
  cumulative_plan?: { date: string; planned: number }[]
  milestones?: { q: number; value: number }[]
  income_model_id?: string | null
  is_team?: boolean
  is_coef?: boolean
  series_id?: string | null
  orig_target?: number | null
  orig_deadline?: string | null
  status?: 'active' | 'paused' | 'stopped'
}
export interface Leading {
  id: string
  name: string
  per_week: number | null
  actuals: Record<string, number>
}
export interface KrActual {
  id: string
  kr_id: string
  date: string
  value: number
  note: string
}
export interface PlanChange {
  id: string
  kr_id: string | null
  period_id: string | null
  type: 'add' | 'raise' | 'method' | 'lower' | 'cut' | 'stop' | 'pause'
  before: Record<string, unknown>
  after: Record<string, unknown>
  reason: string
  cause_group: 'a' | 'b' | 'c' | 'd' | null
  evidence: string
  mentor: string
  status: 'pending' | 'applied' | 'cancelled'
  apply_at: string | null
  applied_at: string | null
  created_at: string
}
export interface IncomeModel {
  id: string
  name: string
  currency: string
  target_income_month: number | null
  fx_rate: number | null
  fx_updated_at: string | null
  value_per_unit: number | null
  unit_name: string
  retention: number | null
  stages: { id: string; name: string; conversion: number | null }[]
  working_days_week: number
  capacity_per_day: number | null
  unknown: Record<string, boolean>
  prev_year_income: number | null
}
export interface VisionItem {
  id: string
  year_no: number
  goal: string
  verification: string
}
export interface EventItem {
  id: string
  period_id: string | null
  date: string
  time: string | null
  title: string
  people: string
  kind: 'lich_hen' | 'deadline' | 'su_kien' | 'loi_hua'
  objective_id: string | null
}

export interface KA {
  id: string
  kr_id: string
  title: string
  done: boolean
  auto_ticked: boolean
  weight: number | null
  from_action_id: string | null
  sort: number
}

export interface Validation {
  id: string
  period_id: string
  direction: 'top_down' | 'cross' | 'bottom_up'
  person: string
  asked: boolean
  smart: Smart
  note: string
  sort: number
}

export type EntryKind = 'viec' | 'loi_hua' | 'lich_hen'
export interface ScheduleItem {
  id: string
  period_id: string
  date: string
  time_from: string | null
  time_to: string | null
  title: string
  people: string
  kind: EntryKind
  fixed: boolean
  done: boolean
  untimed: boolean
  series_id: string | null
  skipped: boolean
  kr_id: string | null
}
export interface ScheduleSeries {
  id: string
  rule: 'daily' | 'weekly' | 'monthly'
  weekdays: number[]
  month_day: number | null
  start_date: string
  end_date: string | null
  time_from: string
  time_to: string
  title: string
  people: string
  kind: EntryKind
  fixed: boolean
  kr_id: string | null
  increment: number
}

export type ObsCategory = 'work_finance' | 'relationship' | 'body_mind_wisdom'
export interface Observation {
  id: string
  period_id: string
  category: ObsCategory
  content: string
  consequence: string
  is_selected: boolean
  tham: string
  san: string
  si: string
  cause_note: string
  resolve_check: boolean
  closed: boolean
  carried_from: string | null
  sort: number
}

export interface NextAction {
  id: string
  period_id: string
  text: string
  smart: Smart
  converted_period_id: string | null
  converted_kr_id: string | null
  converted_ka_id: string | null
  sort: number
}

export interface Settings {
  user_id: string
  red_below: number
  pass_pct: number
  weights_enabled: boolean
  day_min_kr: number
  day_max_kr: number
  max_daily_actions: number
  day_start: string
  day_end: string
  slot_minutes: number
  auto_lock: boolean
  lock_time: string
  red_lock: boolean
  red_streak: number
  rest_weekdays: number[]
  remind_lead_min: number
  gap_suggest_pts: number
  ka_autotick: boolean
  status_red: number
  status_green: number
  kr_min_cvtc: number
  kr_min_other: number
  kr_max_other: number
  max_open_kr: number
  lower_per_kr_quarter: number
  stop_per_quarter: number
  change_cooldown_h: number
  trigger_lag_pct: number
  trigger_weeks: number
  trigger_quarter_pct: number
  default_tab: 'auto' | 'okr' | 'kaizen'
  year_mode: 'month' | 'quarter'
  timezone: string
  vision_start: string | null
}
