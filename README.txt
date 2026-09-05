SkinForge v14 — PRODUCTION READY

Что добавлено:
- HOST / PORT / NODE_ENV через переменные окружения.
- .env.example.
- Security headers.
- Настраиваемый CORS через ALLOWED_ORIGIN.
- Structured JSON logging.
- /api/health и /api/ready для хостинга.
- /api/status для диагностики.
- 404.html.
- favicon.svg, manifest, robots.txt, meta description/theme color.
- Render config: render.yaml.
- Railway config: railway.json.
- Dockerfile + .dockerignore.
- Procfile для совместимых платформ.
- npm run check для быстрой проверки JavaScript.
- Production cache busting v140.

ЛОКАЛЬНЫЙ ЗАПУСК:
npm start
http://localhost:3000

ПРОВЕРКА:
npm run check

RENDER:
1. Загрузи проект в GitHub.
2. New Web Service.
3. Render сам увидит render.yaml или укажи Start Command: npm start.
4. Health Check: /api/health.

RAILWAY:
1. New Project → Deploy from GitHub.
2. Railway прочитает railway.json.
3. Start Command: npm start.

VPS / DOCKER:
docker build -t skinforge .
docker run -p 3000:3000 -e NODE_ENV=production skinforge

Перед публичным запуском рекомендуется задать ALLOWED_ORIGIN на свой домен.
