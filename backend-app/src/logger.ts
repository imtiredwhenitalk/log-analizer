import type { NextFunction, Request, Response } from 'express'

export type AuditLog = {
  timestamp: string
  method: string
  url: string
  status: number
  durationMs: number
  ip: string
  userAgent: string
  userId?: string
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'info', message, ...metadata }))
  },
  error(message: string, metadata?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: 'error', message, ...metadata }))
  },
}

export const loggerMiddleware = (request: Request, response: Response, next: NextFunction): void => {
  const startedAt = Date.now()
  response.on('finish', () => {
    const entry: AuditLog = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.originalUrl,
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
      ip: request.ip ?? 'unknown',
      userAgent: request.get('user-agent') ?? 'unknown',
      ...(request.userId ? { userId: request.userId } : {}),
    }
    const level = response.statusCode >= 500 ? 'error' : 'info'
    logger[level]('HTTP request completed', entry)
  })
  next()
}
