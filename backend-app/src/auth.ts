import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'

const jwtSecret = process.env.JWT_SECRET ?? 'loglens-development-secret-change-me'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  createdAt: string
}

type JwtPayload = { sub: string }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function createToken(userId: string): string {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '7d' })
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ error: 'Authentication required.' })
    return
  }

  try {
    const token = authorization.slice('Bearer '.length)
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload | string
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      response.status(401).json({ error: 'Invalid authentication token.' })
      return
    }

    request.userId = payload.sub
    next()
  } catch {
    response.status(401).json({ error: 'Invalid or expired authentication token.' })
  }
}

export function publicUser(row: { id: string; email: string; display_name: string; created_at: string }): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  }
}

export { jwtSecret }
