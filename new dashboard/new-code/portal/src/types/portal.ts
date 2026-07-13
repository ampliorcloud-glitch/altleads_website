export interface PortalUser {
  client_portal_user_id: number
  auth_uid: string
  user_id: number
  client_assoc_id: number
  portal_role: 'COMPANY_ADMIN' | 'SALES_HEAD' | 'SALES_PERSON'
  enabled: boolean
}

export interface PortalMeeting {
  meeting_id: number
  project_id: number
  client_assoc_id: number
  assigned_user_id: number
  started_at: string | null
  company_name: string | null
  company_industry: string | null
  company_city: string | null
  company_turnover: string | null
  company_size: string | null
  company_sector: string | null
  company_sub_industry: string | null
  company_web_url: string | null
  company_linkedin_url: string | null
  company_description: string | null
  address_line_one: string | null
  address_line_two: string | null
  address_city: string | null
  address_state: string | null
  address_country: string | null
  lead_name: string | null
  lead_designation: string | null
  lead_email: string | null
  lead_mobile_no: string | null
  lead_alt_mobile_no: string | null
  lead_linkedin_url: string | null
  lead_role_and_resp: string | null
  lead_area_of_interest: string | null
  opportunity_title: string | null
  opportunity_value: string | null
  opportunity_description: string | null
  sales_intelligence: string | null
  meeting_name: string | null
  meeting_date: string | null
  meeting_time: string | null
  meeting_duration: string | null
  meeting_mode: string | null
  meeting_status: string | null
  meeting_url: string | null
  meeting_description: string | null
  meeting_reason: string | null
  scheduled_by_name: string | null
  assigned_rep_name: string | null
  pre_sales_qa: PreSalesQA[] | null
  agenda_discussion: string | null
  snapshot_taken_at: string
  snapshot_refreshed_at: string | null
  snapshot_source: 'live' | 'backfill'
}

export interface PreSalesQA {
  question: string
  short_question: string
  answer: string
}

export interface PortalNotification {
  notification_id: number
  recipient_auth_uid: string
  client_assoc_id: number
  project_id: number | null
  kind: string | null
  body: string | null
  route: string | null
  is_read: boolean
  read_at: string | null
  created_date: string
}

export interface DashboardMetrics {
  client_assoc_id: number
  project_id: number
  assigned_user_id: number | null
  total_meetings: number
  scheduled_count: number
  completed_count: number
  rescheduled_count: number
  dropped_count: number
  missed_count: number
}

export type MeetingStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'Completed'
  | 'Rescheduled'
  | 'Cancelled'
  | 'Missed'

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Scheduled:   { bg: '#EFF6FF', text: '#3B82F6', border: '#3B82F6' },
  Confirmed:   { bg: '#EFF6FF', text: '#3B82F6', border: '#3B82F6' },
  Completed:   { bg: '#F0FDF4', text: '#16A34A', border: '#22C55E' },
  Rescheduled: { bg: '#FFF7ED', text: '#EA580C', border: '#F57C1F' },
  Cancelled:   { bg: '#FFF1F2', text: '#B72025', border: '#EF4444' },
  Missed:      { bg: '#FFFBEB', text: '#D97706', border: '#FCC02A' },
}
