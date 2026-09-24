import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { analyzeLog, type AnalysisResult } from './analyzer.js'
import { analysisQueries, notificationQueries, toAnalysisResult, userQueries, type UserRow } from './db.js'
import { createToken, hashPassword, publicUser, requireAuth, verifyPassword } from './auth.js'
import { loggerMiddleware } from './logger.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3000)
const MAX_FILE_SIZE = 10 * 1024 * 1024
const allowedExtensions = new Set(['.log', '.txt', '.json', '.csv'])

type PublicUserRow = Pick<UserRow, 'id' | 'email' | 'display_name' | 'role' | 'company' | 'timezone' | 'theme' | 'email_notifications' | 'security_alerts' | 'created_at'>

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()
    if (!allowedExtensions.has(extension)) {
      callback(new Error('Unsupported file type. Use .log, .txt, .json, or .csv.'))
      return
    }
    callback(null, true)
  },
})

app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))
app.use((request, response, next) => {
  const allowedOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Access-Control-Expose-Headers', 'Content-Length')
  if (request.method === 'OPTIONS') {
    response.sendStatus(204)
    return
  }
  next()
})
app.use(loggerMiddleware)

function asBodyRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return {}
  return body as Record<string, unknown>
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE'
}

function getRequiredUserId(request: Request, response: Response): string | null {
  if (!request.userId) {
    response.status(401).json({ error: 'Authentication required.' })
    return null
  }
  return request.userId
}

function parseStoredResults(rows: unknown[]): AnalysisResult[] {
  return rows.map((row) => toAnalysisResult(row as Parameters<typeof toAnalysisResult>[0]))
}

app.get('/', (_request, response) => {
  response.json({ message: 'Loglens API is running', docs: '/api/health' })
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'loglens-api', database: 'sqlite' })
})

app.post('/api/auth/register', async (request, response, next) => {
  const body = asBodyRecord(request.body)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const role = typeof body.role === 'string' ? body.role.trim() : 'Security Analyst'
  const company = typeof body.company === 'string' ? body.company.trim() : 'Acme Cloud'

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    response.status(400).json({ error: 'Enter a valid email address.' })
    return
  }
  if (password.length < 8 || password.length > 128) {
    response.status(400).json({ error: 'Password must be between 8 and 128 characters.' })
    return
  }
  if (displayName.length < 2 || displayName.length > 60) {
    response.status(400).json({ error: 'Name must be between 2 and 60 characters.' })
    return
  }
  if (role.length < 2 || role.length > 80 || company.length < 2 || company.length > 100) {
    response.status(400).json({ error: 'Role and company must be between 2 and 100 characters.' })
    return
  }

  try {
    const existing = userQueries.findByEmail.get(email) as UserRow | undefined
    if (existing) {
      response.status(409).json({ error: 'An account with this email already exists.' })
      return
    }

    const id = randomUUID()
    const passwordHash = await hashPassword(password)
    userQueries.create.run({ id, email, display_name: displayName, role, company, timezone: 'UTC', theme: 'light', email_notifications: 1, security_alerts: 1, password_hash: passwordHash })
    const user = userQueries.findById.get(id) as PublicUserRow
    response.status(201).json({ user: publicUser(user), token: createToken(id) })
  } catch (error) {
    if (isUniqueConstraint(error)) {
      response.status(409).json({ error: 'An account with this email already exists.' })
      return
    }
    next(error)
  }
})

app.post('/api/auth/login', async (request, response, next) => {
  const body = asBodyRecord(request.body)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    response.status(400).json({ error: 'Email and password are required.' })
    return
  }

  try {
    const user = userQueries.findByEmail.get(email) as UserRow | undefined
    const valid = user ? await verifyPassword(password, user.password_hash) : false
    if (!user || !valid) {
      response.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    response.json({ user: publicUser(user), token: createToken(user.id) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', requireAuth, (request, response) => {
  const userId = getRequiredUserId(request, response)
  if (!userId) return

  const user = userQueries.findById.get(userId) as PublicUserRow | undefined
  if (!user) {
    response.status(404).json({ error: 'User account not found.' })
    return
  }
  response.json({ user: publicUser(user) })
})

app.put('/api/auth/profile', requireAuth, (request, response, next) => {
  const userId = getRequiredUserId(request, response)
  if (!userId) return

  const body = asBodyRecord(request.body)
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const role = typeof body.role === 'string' ? body.role.trim() : ''
  const company = typeof body.company === 'string' ? body.company.trim() : ''
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : 'UTC'
  const theme = body.theme === 'dark' || body.theme === 'system' ? body.theme : 'light'
  const emailNotifications = typeof body.emailNotifications === 'boolean' ? body.emailNotifications : true
  const securityAlerts = typeof body.securityAlerts === 'boolean' ? body.securityAlerts : true
  if (displayName.length < 2 || displayName.length > 60) {
    response.status(400).json({ error: 'Name must be between 2 and 60 characters.' })
    return
  }
  if (role.length < 2 || role.length > 80) {
    response.status(400).json({ error: 'Role must be between 2 and 80 characters.' })
    return
  }
  if (company.length < 2 || company.length > 100) {
    response.status(400).json({ error: 'Company must be between 2 and 100 characters.' })
    return
  }

  try {
    userQueries.updateProfile.run({ id: userId, display_name: displayName, role, company, timezone, theme, email_notifications: emailNotifications ? 1 : 0, security_alerts: securityAlerts ? 1 : 0 })
    const user = userQueries.findById.get(userId) as PublicUserRow | undefined
    if (!user) {
      response.status(404).json({ error: 'User account not found.' })
      return
    }
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', requireAuth, (_request, response) => {
  response.status(204).send()
})

app.post('/api/analyze', requireAuth, upload.single('file'), (request, response) => {
  const userId = getRequiredUserId(request, response)
  if (!userId) return
  if (!request.file) {
    response.status(400).json({ error: 'Attach a log file using the "file" field.' })
    return
  }

  if (request.file.buffer.subarray(0, 8192).includes(0)) {
    response.status(415).json({ error: 'The uploaded file does not look like a text log.' })
    return
  }

  const fileName = path.basename(request.file.originalname)
  const result = analyzeLog(fileName, request.file.buffer.toString('utf8'))
  analysisQueries.create.run({
    id: result.id,
    user_id: userId,
    file_name: result.fileName,
    analyzed_at: result.analyzedAt,
    result_json: JSON.stringify(result),
  })
  const owner = userQueries.findById.get(userId) as PublicUserRow | undefined
  if (result.summary.findingCount > 0 && owner?.security_alerts) {
    notificationQueries.create.run({
      id: randomUUID(),
      user_id: userId,
      title: result.summary.criticalFindings > 0 ? 'Critical activity detected' : 'New security findings',
      message: `${result.fileName} contains ${result.summary.attackEvents} suspicious event${result.summary.attackEvents === 1 ? '' : 's'}.`,
      kind: result.summary.criticalFindings > 0 ? 'security' : 'system',
    })
  }
  response.status(201).json(result)
})

app.get('/api/notifications', requireAuth, (request, response) => {
  const userId = getRequiredUserId(request, response)
  if (!userId) return
  response.json(notificationQueries.listByUser.all(userId))
})

app.patch('/api/notifications/:id/read', requireAuth, (request: Request<{ id: string }>, response) => {
  const userId = getRequiredUserId(request, response)
  if (!userId) return
  notificationQueries.markRead.run({ id: request.params.id, user_id: userId })
  response.status(204).send()
})

app.post('/api/notifications/read-all', requireAuth, (request, response) => {
  const userId = getRequiredUserId(request, response)
  if (!userId) return
  notificationQueries.markAllRead.run(userId)
  response.status(204).send()
})

app.get('/api/analyses', requireAuth, (request, response) => {
  const userId = getRequiredUserId(request, response)
  if (!userId) return

  const rows = analysisQueries.listByUser.all(userId)
  response.json(parseStoredResults(rows))
})

app.get('/api/analyses/:id', requireAuth, (request: Request<{ id: string }>, response) => {
  const userId = getRequiredUserId(request, response)
  if (!userId) return

  const row = analysisQueries.findByIdForUser.get(request.params.id, userId)
  if (!row) {
    response.status(404).json({ error: 'Analysis not found.' })
    return
  }
  response.json(toAnalysisResult(row as Parameters<typeof toAnalysisResult>[0]))
})

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({ error: 'File is too large. Maximum size is 10 MB.' })
      return
    }
    response.status(400).json({ error: error.message })
    return
  }

  if (error instanceof Error) {
    response.status(400).json({ error: error.message })
    return
  }

  response.status(500).json({ error: 'Unexpected server error.' })
})

app.listen(PORT, () => {
  if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not set; using a development secret.')
  console.log(`Loglens API running on http://localhost:${PORT}`)
})
