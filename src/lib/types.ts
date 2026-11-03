export type SmartKey = 'S' | 'M' | 'A' | 'R' | 'T' | 'O'
export type Smart = Partial<Record<SmartKey, boolean>>

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

export type PeriodKind = 'month' | 'week' | 'day'

export interface VerifyRow {
  who: string
  text: string
  smart: Smart
}

export interface Observe {
  work?: string
  rel?: string
  body?: string
  analysis?: string
  tham?: string
  si?: string
  grid?: Record<string, { s?: string; c?: string; t?: string }>
  verify?: Partial<Record<'top' | 'cross' | 'bottom', VerifyRow[]>>
  unlocks?: { at: string; reason: string }[]
}

export interface KaizenData {
  s?: string
  c?: string
  t?: string
  causes?: string
  lessons?: string
}

export interface Period {
  id: string
  kind: PeriodKind
  start_date: string
  focus_title: string | null
  focus_smart: Smart
  activated_goal_ids: string[]
  observe: Observe
  kaizen: KaizenData
  locked_at: string | null
  checked_in_at: string | null
}

export interface KR {
  id: string
  period_id: string
  goal_id: string
  parent_kr_id: string | null
  metric_id: string | null
  title: string
  target: number
  unit: string
  smart: Smart
  sort: number
}

export interface Task {
  id: string
  period_id: string
  kr_id: string | null
  title: string
  target: number
  unit: string
  actual: number | null
  sort: number
}

export interface Action {
  id: string
  period_id: string
  text: string
  smart: Smart
  push_to_period_id: string | null
  done: boolean
}

export interface Settings {
  user_id: string
  lock_time: string
  green_pct: number
  yellow_pct: number
  red_streak: number
  rest_weekdays: number[]
  timezone: string
}
