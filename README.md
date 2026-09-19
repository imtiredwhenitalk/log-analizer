# Loglens

Веб-приложение для первичного анализа security/access-логов. Загруженный файл отправляется на backend, где он разбирается по сигнатурам подозрительной активности и возвращается структурированный отчёт: тип атаки, severity, confidence, строки-примеры, IP-адреса и рекомендации.

## Запуск

В двух терминалах из корня проекта:

```bash
cd backend-app
npm run dev
```

```bash
cd frontend
npm run dev
```

Откройте адрес Vite (обычно `http://localhost:5173`). Frontend по умолчанию обращается к API на `http://localhost:3000`. При необходимости адрес можно изменить:

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```

## API

- `GET /api/health` — состояние backend.
- `POST /api/analyze` — multipart upload с полем `file`.
- `GET /api/analyses` — последние результаты в памяти процесса.
- `GET /api/analyses/:id` — конкретный результат.

Поддерживаются `.log`, `.txt`, `.json`, `.csv`, размер файла — до 10 MB.

## Что ищет анализатор

SQL injection, XSS, path traversal, command injection, SSRF, JNDI/Log4Shell, server-side code injection, автоматические vulnerability scanners и повторяющиеся ошибки аутентификации, похожие на brute force.

Это signature-based анализ логов, а не полноценный pentest или доказательство эксплуатации. Результат нужно проверять по WAF, application и host telemetry.
