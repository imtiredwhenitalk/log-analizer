export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Detection = {
  id: string
  title: string
  attackType: string
  severity: Severity
  confidence: number
  occurrences: number
  description: string
  recommendation: string
  examples: { line: number; snippet: string }[]
}

export type AnalysisResult = {
  id: string
  fileName: string
  analyzedAt: string
  summary: {
    totalLines: number
    requestCount: number
    errorCount: number
    status4xx: number
    status5xx: number
    attackEvents: number
    findingCount: number
    criticalFindings: number
    uniqueIps: number
    averageResponseMs: number | null
  }
  detections: Detection[]
  topIps: { ip: string; count: number }[]
  methodCounts: Record<string, number>
  statusCounts: Record<string, number>
  disclaimer: string
}

export type User = {
  id: string
  email: string
  displayName: string
  createdAt: string
}

type ApiError = { error?: string }
type AuthResponse = { user: User; token: string }

const apiBase = (import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:3000' : '')).replace(/\/$/, '')
const tokenKey = 'loglens_token'

function token(): string | null {
  return localStorage.getItem(tokenKey)
}

function headers(withJson = false): HeadersInit {
  const result: Record<string, string> = {}
  if (withJson) result['Content-Type'] = 'application/json'
  const savedToken = token()
  if (savedToken) result.Authorization = `Bearer ${savedToken}`
  return result
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { ...headers(options.body !== undefined && !(options.body instanceof FormData)), ...options.headers },
  })
  const payload = (await response.json().catch(() => ({}))) as T & ApiError
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(tokenKey)
    throw new Error(payload.error ?? 'Request failed.')
  }
  return payload
}

function saveAuth(response: AuthResponse): User {
  localStorage.setItem(tokenKey, response.token)
  return response.user
}

export async function login(email: string, password: string): Promise<User> {
  return saveAuth(await request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }))
}

export async function register(email: string, password: string, displayName: string): Promise<User> {
  return saveAuth(await request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }))
}

export async function currentUser(): Promise<User | null> {
  if (!token()) return null
  try {
    return (await request<{ user: User }>('/api/auth/me')).user
  } catch {
    localStorage.removeItem(tokenKey)
    return null
  }
}

export async function logout(): Promise<void> {
  try {
    if (token()) await request<void>('/api/auth/logout', { method: 'POST' })
  } finally {
    localStorage.removeItem(tokenKey)
  }
}

export async function analyzeLogFile(file: File): Promise<AnalysisResult> {
  const body = new FormData()
  body.append('file', file)
  return request<AnalysisResult>('/api/analyze', { method: 'POST', body })
}

export async function listAnalyses(): Promise<AnalysisResult[]> {
  return request<AnalysisResult[]>('/api/analyses')
}
