// Клиент REST API бэкенда Metka (FastAPI).
// В dev-режиме запросы на /api проксирует Vite (см. vite.config.js),
// в production фронтенд раздаётся самим FastAPI, поэтому адрес тот же.
// Если API живёт на другом домене — задайте VITE_API_URL в frontend/.env.
const BASE = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'metka-token'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = token => {
  try { localStorage.setItem(TOKEN_KEY, token) } catch { /* storage недоступен */ }
}
export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* storage недоступен */ }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// App подписывается сюда, чтобы разлогинить пользователя при 401 (токен истёк)
let onUnauthorized = () => {}
export const setUnauthorizedHandler = fn => { onUnauthorized = fn }

function errorMessage(data, status) {
  const detail = data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    const field = first.loc?.[first.loc.length - 1]
    return field ? `${field}: ${first.msg}` : first.msg
  }
  return `Ошибка сервера (${status})`
}

async function request(path, { method = 'GET', json, form, auth = true } = {}) {
  const headers = {}
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = new URLSearchParams(form) // application/x-www-form-urlencoded для OAuth2 login
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body })
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте, что бэкенд запущен.', 0)
  }

  if (res.status === 204) return null
  let data = null
  try { data = await res.json() } catch { /* пустое или не-JSON тело */ }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      clearToken()
      onUnauthorized()
    }
    throw new ApiError(errorMessage(data, res.status), res.status)
  }
  return data
}

// ---- Преобразование моделей бэкенда в модели интерфейса ----
export const toTag = t => ({ id: t.id, name: t.name, color: t.color })

export const toNote = n => ({
  id: n.id,
  title: n.title || '',
  body: n.text || '',
  tagId: n.tag_id ?? n.tag_ids?.[0] ?? null,
  tagIds: Array.isArray(n.tag_ids) ? n.tag_ids : (n.tag_id != null ? [n.tag_id] : []),
  tags: Array.isArray(n.tags) ? n.tags.map(toTag) : [],
  date: n.date,
})

export const api = {
  register: data => request('/api/auth/register', { method: 'POST', json: data, auth: false }),
  login: (login, password) =>
    request('/api/auth/login', { method: 'POST', form: { username: login, password }, auth: false }),
  me: () => request('/api/users/me'),

  notes: () => request('/api/notes'),
  createNote: data => request('/api/notes', { method: 'POST', json: data }),
  updateNote: (id, data) => request(`/api/notes/${id}`, { method: 'PATCH', json: data }),
  deleteNote: id => request(`/api/notes/${id}`, { method: 'DELETE' }),

  tags: () => request('/api/tags'),
  createTag: data => request('/api/tags', { method: 'POST', json: data }),
  updateTag: (id, data) => request(`/api/tags/${id}`, { method: 'PATCH', json: data }),
  deleteTag: id => request(`/api/tags/${id}`, { method: 'DELETE' }),

  users: () => request('/api/users'),
  deleteUser: id => request(`/api/users/${id}`, { method: 'DELETE' }),
}
