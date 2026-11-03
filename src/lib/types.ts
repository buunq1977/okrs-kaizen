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
export type PeriodKind = 'day' | 'week' | 'month' | 'year'

export interface Lesson {
  id: string
  text: string
  keyword: string
  signal: string
}
export interface KaizenData {
  assessment?: string
  journal?: { s?: string; c?: string; t?: string }
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
  o_title: string
  o_smart: Smart
  o_metric: string
  linked: boolean
  link_reason: string
  goal_id: string | null
  no_fixed_schedule: boolean
  kaizen: KaizenData
}

export interface KR {
  id: string
  period_id: string
  title: string
  metric: string
  smart: Smart
  linked: boolean
  link_reason: string
  weight: number | null
  pct_override: number | null
  override_reason: string | null
  from_action_id: string | null
  sort: number
}

export interface KA {
  id: string
  kr_id: string
  title: string
  done: boolean
  weight: number | null
  from_action_id: string | null
  sort: number
}

export interface ScheduleItem {
  id: string
  period_id: string
  date: string
  time_from: string
  time_to: string
  title: string
  people: string
  fixed: boolean
  done: boolean
  kr_id: string | null
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
  only_linked_pct: boolean
  show_both_pct: boolean
  weights_enabled: boolean
  link_pct: number
  day_min_linked_kr: number
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
  remind_time: string
  year_mode: 'month' | 'quarter'
  timezone: string
}
