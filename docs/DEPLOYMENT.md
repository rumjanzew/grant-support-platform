# Production deployment

Требования: Ubuntu 24.04 LTS, Docker Engine и Docker Compose plugin.

## Первый запуск

```bash
git clone https://github.com/rumjanzew/grant-support-platform.git grant-support
cd grant-support
git checkout main
cp .env.production.example .env.production
nano .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d db
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend python manage.py migrate
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend python manage.py collectstatic --noinput
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Демонстрационные данные production-командами не создаются. Для первого администратора:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

React доступен на `/`, API — на `/api/`, Swagger — на `/api/docs/`, Django Admin — на `/django-admin/`.

## Обновление

```bash
git checkout main
git pull --ff-only origin main
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend python manage.py migrate
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend python manage.py collectstatic --noinput
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Диагностика и резервная копия

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 backend frontend db
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > grant_support_backup.sql
```

Восстановление выполняйте только в согласованное окно обслуживания после проверки файла backup:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < grant_support_backup.sql
```

## Базовый rollback

Переключите Git на предыдущий проверенный tag или commit, повторите `build`, `collectstatic` и `up -d`. Миграции автоматически назад не откатываются. Если новая схема несовместима, восстановите сделанную перед обновлением резервную копию PostgreSQL.
