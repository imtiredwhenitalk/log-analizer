import fs from 'node:fs'
import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import path from 'node:path'
import type { AnalysisResult } from './analyzer.js'

type UserRow = {
  id: string
  email: string
  display_name: string
  role: string
  company: string
  timezone: string
  theme: string
  email_notifications: number
  security_alerts: number
  password_hash: string
  created_at: string
}

export type NotificationRow = {
  id: string
  user_id: string
  title: string
  message: string
  kind: 'security' | 'system' | 'success'
  created_at: string
  read_at: string | null
}

export type AnalysisRow = {
  id: string
  user_id: string
  file_name: string
  analyzed_at: string
  result_json: string
}

type UserInsert = {
  id: string
  email: string
  display_name: string
  role: string
  company: string
  timezone: string
  theme: string
  email_notifications: number
  security_alerts: number
  password_hash: string
}

type AnalysisInsert = {
  id: string
  user_id: string
  file_name: string
  analyzed_at: string
  result_json: string
}

const databasePath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'loglens.db')
fs.mkdirSync(path.dirname(databasePath), { recursive: true })

const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Security Analyst',
    company TEXT NOT NULL DEFAULT 'Acme Cloud',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    theme TEXT NOT NULL DEFAULT 'light',
    email_notifications INTEGER NOT NULL DEFAULT 1,
    security_alerts INTEGER NOT NULL DEFAULT 1,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    analyzed_at TEXT NOT NULL,
    result_json TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_analyses_user_date
    ON analyses(user_id, analyzed_at DESC);

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user_date
    ON notifications(user_id, created_at DESC);
`)

const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
if (!userColumns.some((column) => column.name === 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Security Analyst'")
}
if (!userColumns.some((column) => column.name === 'company')) {
  db.exec("ALTER TABLE users ADD COLUMN company TEXT NOT NULL DEFAULT 'Acme Cloud'")
}
if (!userColumns.some((column) => column.name === 'timezone')) {
  db.exec("ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'")
}
if (!userColumns.some((column) => column.name === 'theme')) {
  db.exec("ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'light'")
}
if (!userColumns.some((column) => column.name === 'email_notifications')) {
  db.exec('ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1')
}
if (!userColumns.some((column) => column.name === 'security_alerts')) {
  db.exec('ALTER TABLE users ADD COLUMN security_alerts INTEGER NOT NULL DEFAULT 1')
}

export const userQueries: {
  findByEmail: BetterSqlite3.Statement<[string], UserRow>
  findById: BetterSqlite3.Statement<[string], Pick<UserRow, 'id' | 'email' | 'display_name' | 'role' | 'company' | 'timezone' | 'theme' | 'email_notifications' | 'security_alerts' | 'created_at'>>
  create: BetterSqlite3.Statement<[UserInsert], unknown>
  updateProfile: BetterSqlite3.Statement<[{ id: string; display_name: string; role: string; company: string; timezone: string; theme: string; email_notifications: number; security_alerts: number }], unknown>
} = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT id, email, display_name, role, company, timezone, theme, email_notifications, security_alerts, created_at FROM users WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO users (id, email, display_name, role, company, timezone, theme, email_notifications, security_alerts, password_hash)
    VALUES (@id, @email, @display_name, @role, @company, @timezone, @theme, @email_notifications, @security_alerts, @password_hash)
  `),
  updateProfile: db.prepare(`
    UPDATE users
    SET display_name = @display_name, role = @role, company = @company,
        timezone = @timezone, theme = @theme,
        email_notifications = @email_notifications, security_alerts = @security_alerts
    WHERE id = @id
  `),
}

export const notificationQueries: {
  create: BetterSqlite3.Statement<[{ id: string; user_id: string; title: string; message: string; kind: string }], unknown>
  listByUser: BetterSqlite3.Statement<[string], NotificationRow>
  markRead: BetterSqlite3.Statement<[{ id: string; user_id: string }], unknown>
  markAllRead: BetterSqlite3.Statement<[string], unknown>
} = {
  create: db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, kind)
    VALUES (@id, @user_id, @title, @message, @kind)
  `),
  listByUser: db.prepare(`
    SELECT id, user_id, title, message, kind, created_at, read_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `),
  markRead: db.prepare(`
    UPDATE notifications SET read_at = CURRENT_TIMESTAMP
    WHERE id = @id AND user_id = @user_id
  `),
  markAllRead: db.prepare(`
    UPDATE notifications SET read_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND read_at IS NULL
  `),
}

export const analysisQueries: {
  create: BetterSqlite3.Statement<[AnalysisInsert], unknown>
  listByUser: BetterSqlite3.Statement<[string], AnalysisRow>
  findByIdForUser: BetterSqlite3.Statement<[string, string], AnalysisRow>
} = {
  create: db.prepare(`
    INSERT INTO analyses (id, user_id, file_name, analyzed_at, result_json)
    VALUES (@id, @user_id, @file_name, @analyzed_at, @result_json)
  `),
  listByUser: db.prepare(`
    SELECT id, user_id, file_name, analyzed_at, result_json
    FROM analyses
    WHERE user_id = ?
    ORDER BY analyzed_at DESC
    LIMIT 50
  `),
  findByIdForUser: db.prepare(`
    SELECT id, user_id, file_name, analyzed_at, result_json
    FROM analyses
    WHERE id = ? AND user_id = ?
  `),
}

export function toAnalysisResult(row: AnalysisRow): AnalysisResult {
  return JSON.parse(row.result_json) as AnalysisResult
}

export type { UserRow }
