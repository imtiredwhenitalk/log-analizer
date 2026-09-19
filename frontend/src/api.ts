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

type ApiError = { error?: string }

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function analyzeLogFile(file: File): Promise<AnalysisResult> {
  const body = new FormData()
  body.append('file', file)

  const response = await fetch(`${apiBase}/api/analyze`, { method: 'POST', body })
  const payload = (await response.json()) as AnalysisResult & ApiError
  if (!response.ok) throw new Error(payload.error ?? 'Could not analyze this file.')
  return payload
}
