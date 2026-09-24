# Loglens

Полноценный MVP для анализа security/access-логов. Пользователь регистрируется, входит в свой workspace, загружает лог, получает отчёт по подозрительной активности, а результаты сохраняются в SQLite и доступны после перезапуска.

## Быстрый запуск через Docker

```bash
# из корня проекта
JWT_SECRET="change-this-to-a-long-random-secret" docker compose up --build
```

Откройте `http://localhost:8080`. SQLite-файл хранится в Docker volume `loglens-data`.

Остановка:

```bash
docker compose down
```

Для удаления базы вместе с volume:

```bash
docker compose down -v
```

## Локальный запуск

Backend:

```bash
cd backend-app
npm install
npm run dev
```

Frontend в отдельном терминале:

```bash
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173`. Frontend обращается к API на `http://localhost:3000`.

## Возможности

- Регистрация и вход по email/password.
- Профиль пользователя с отображением роли и текущей компании.
- Редактирование имени, роли и компании из раздела Settings.
- Настройки часового пояса, темы, email-обновлений и security alerts.
- Центр уведомлений с непрочитанными событиями и отметкой прочитанного.
- Пароли хешируются через `bcryptjs`.
- JWT-аутентификация с expiry 7 дней.
- Защищённые API-эндпоинты: анализы доступны только владельцу.
- SQLite база с таблицами `users` и `analyses`.
- История анализов сохраняется между перезапусками.
- Upload `.log`, `.txt`, `.json`, `.csv` до 10 MB.
- Анализ SQL Injection, XSS, Path Traversal, Command Injection, SSRF, JNDI/Log4Shell, server-side code injection, vulnerability scanners и brute-force.
- Отчёт содержит severity, confidence, количество событий, номера строк, IP и рекомендации.
- JSON audit logging HTTP-запросов в backend.
- Docker Compose: frontend + backend + persistent SQLite volume.

## API

Auth:

- `POST /api/auth/register` — `{ email, password, displayName, role?, company? }`.
- `POST /api/auth/login` — `{ email, password }`.
- `GET /api/auth/me` — текущий пользователь.
- `PUT /api/auth/profile` — `{ displayName, role, company, timezone, theme, emailNotifications, securityAlerts }`, обновление профиля и настроек.
- `GET /api/notifications` — уведомления текущего пользователя.
- `PATCH /api/notifications/:id/read` — отметить уведомление прочитанным.
- `POST /api/notifications/read-all` — отметить все уведомления прочитанными.
- `POST /api/auth/logout` — завершение клиентской сессии.

Анализы требуют `Authorization: Bearer <token>`:

- `GET /api/health` — состояние backend и базы.
- `POST /api/analyze` — multipart upload с полем `file`.
- `GET /api/analyses` — история текущего пользователя.
- `GET /api/analyses/:id` — конкретный анализ текущего пользователя.

## Что важно для production

Задайте длинный случайный `JWT_SECRET`, используйте HTTPS и не оставляйте development secret из compose-файла. Анализатор является signature-based системой: он выявляет подозрительные признаки в логах, но не заменяет полноценный pentest и не доказывает факт успешной эксплуатации.
