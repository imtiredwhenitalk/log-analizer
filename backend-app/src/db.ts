import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { AnalysisResult } from './analyzer.js'

type UserRow = {
  id: string
  email: string
  display_name: string
  password_hash: string
  created_at: string
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
`)

export const userQueries: {
  findByEmail: BetterSqlite3.Statement<[string], UserRow>
  findById: BetterSqlite3.Statement<[string], Pick<UserRow, 'id' | 'email' | 'display_name' | 'created_at'>>
  create: BetterSqlite3.Statement<[UserInsert], unknown>
} = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash)
    VALUES (@id, @email, @display_name, @password_hash)
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
