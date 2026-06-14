import axios, { AxiosError } from 'axios'
import { message } from 'antd'
import type { User, Role, Permission, Status, Transition, Ticket, TicketHistory, LoginResult, OperationLog } from './types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const msg = error.response?.data?.error || error.message || '请求失败'
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else {
      message.error(msg)
    }
    return Promise.reject(error)
  }
)

// Auth
export const login = (username: string, password: string) =>
  api.post<LoginResult>('/auth/login', { username, password }).then((r) => r.data)

export const getMe = () => api.get<User>('/auth/me').then((r) => r.data)

export const logout = () => api.post('/auth/logout').then((r) => r.data)

// Tickets
export const listTickets = (params?: Record<string, unknown>) =>
  api.get<Ticket[]>('/tickets', { params }).then((r) => r.data)

export const getTicket = (id: number) =>
  api.get<Ticket>(`/tickets/${id}`).then((r) => r.data)

export const createTicket = (data: Partial<Ticket>) =>
  api.post<Ticket>('/tickets', data).then((r) => r.data)

export const updateTicket = (id: number, data: Partial<Ticket>) =>
  api.put<Ticket>(`/tickets/${id}`, data).then((r) => r.data)

export const deleteTicket = (id: number) =>
  api.delete(`/tickets/${id}`).then((r) => r.data)

export const getTicketHistory = (id: number) =>
  api.get<TicketHistory[]>(`/tickets/${id}/history`).then((r) => r.data)

// Statuses
export const listStatuses = () =>
  api.get<Status[]>('/statuses').then((r) => r.data)

export const createStatus = (data: Partial<Status>) =>
  api.post<Status>('/statuses', data).then((r) => r.data)

export const updateStatus = (id: number, data: Partial<Status>) =>
  api.put<Status>(`/statuses/${id}`, data).then((r) => r.data)

export const deleteStatus = (id: number) =>
  api.delete(`/statuses/${id}`).then((r) => r.data)

export const listTransitions = () =>
  api.get<Transition[]>('/statuses/transitions').then((r) => r.data)

export const createTransition = (data: { from_status_id: number | null; to_status_id: number }) =>
  api.post('/statuses/transitions', data).then((r) => r.data)

export const deleteTransition = (id: number) =>
  api.delete(`/statuses/transitions/${id}`).then((r) => r.data)

export const getNextStatuses = (fromId: number) =>
  api.get<Status[]>(`/statuses/${fromId}/next`).then((r) => r.data)

// Users
export const listUsers = () => api.get<User[]>('/users').then((r) => r.data)

export const getUser = (id: number) => api.get<User>(`/users/${id}`).then((r) => r.data)

export const createUser = (data: Partial<User> & { password: string }) =>
  api.post<User>('/users', data).then((r) => r.data)

export const updateUser = (id: number, data: Partial<User> & { password?: string }) =>
  api.put<User>(`/users/${id}`, data).then((r) => r.data)

export const deleteUser = (id: number) =>
  api.delete(`/users/${id}`).then((r) => r.data)

export const listRoles = () => api.get<Role[]>('/users/roles').then((r) => r.data)

export const listPermissions = () =>
  api.get<Permission[]>('/users/permissions').then((r) => r.data)

export const getRolePermissions = (roleId: number) =>
  api.get<Permission[]>(`/users/roles/${roleId}/permissions`).then((r) => r.data)

export const setRolePermissions = (roleId: number, permissionIds: number[]) =>
  api.put<Permission[]>(`/users/roles/${roleId}/permissions`, { permission_ids: permissionIds }).then((r) => r.data)

// Logs
export const listLogs = (params?: Record<string, unknown>) =>
  api.get<{ items: OperationLog[]; total: number; page: number; page_size: number }>('/logs', { params }).then((r) => r.data)

export default api
