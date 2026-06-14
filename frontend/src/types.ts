export interface User {
  id: number
  username: string
  role_id: number | null
  role_name: string | null
  is_active: boolean
  created_at: string
}

export interface Role {
  id: number
  name: string
  description: string | null
}

export interface Permission {
  id: number
  name: string
  description: string | null
}

export interface Status {
  id: number
  name: string
  color: string
  sort_order: number
  is_default: boolean
  created_at: string
}

export interface Transition {
  id: number
  from_status_id: number | null
  to_status_id: number
  from_name: string | null
  to_name: string
}

export interface Ticket {
  id: number
  title: string
  description: string | null
  status_id: number | null
  status_name: string | null
  status_color: string | null
  priority: string
  creator_id: number
  creator_name: string | null
  assignee_id: number | null
  assignee_name: string | null
  created_at: string
  updated_at: string
}

export interface TicketHistory {
  id: number
  ticket_id: number
  field: string
  old_value: string | null
  new_value: string | null
  changed_by: number
  changed_by_name: string | null
  changed_at: string
}

export interface OperationLog {
  id: number
  user_id: number | null
  username: string | null
  action: string
  target_type: string | null
  target_id: number | null
  detail: string | null
  ip_address: string | null
  created_at: string
}

export interface LoginResult {
  access_token: string
  user: User
}
