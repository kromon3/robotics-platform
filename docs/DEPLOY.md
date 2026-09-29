# Инструкция по развёртыванию и запуску

Платформа подбора роботизированных решений. Документ покрывает три случая: посмотреть готовый стенд, поднять у себя одной командой, развернуть на сервере с нуля.

---

## 1. Посмотреть без установки

Работающий стенд: **http://135.106.228.142**

| Адрес | Что |
|---|---|
| http://135.106.228.142 | Приложение |
| http://135.106.228.142/admin | Административный интерфейс каталога |
| http://135.106.228.142/api/docs | Swagger (OpenAPI) |
| http://135.106.228.142/api/catalog/products | API каталога |

### Демонстрационные учётные записи

| Роль | Логин | Пароль | Что даёт |
|---|---|---|---|
| Администратор | `admin@robotics.local` | `admin12345` | админка каталога, управление пользователями и ролями |
| Пользователь | `user@robotics.local` | `user12345` | сохранение и просмотр своих расчётов |
| Гость | — | — | каталог, подбор, экономика и имитация без входа |

Пошаговая проверка функций — в [DEMO.md](DEMO.md).

---

## 2. Запуск на своей машине

Нужен только Docker (Desktop на Windows и macOS, движок на Linux). Больше ничего ставить не требуется: Node, PostgreSQL и зависимости живут внутри контейнеров.

```bash
git clone https://github.com/kromon3/robotics-platform.git
cd robotics-platform
docker compose up --build
```

Первая сборка занимает 3–10 минут в зависимости от машины. Когда в логе появится `Nest application successfully started`, открыть **http://localhost:8080**.

Поднимаются три контейнера:

| Контейнер | Что делает |
|---|---|
| `db` | PostgreSQL 16, данные в именованном томе `pgdata` |
| `api` | NestJS: накатывает миграции, засевает базу, отдаёт REST API, админку и фотографии |
| `web` | nginx: раздаёт собранный фронтенд и проксирует `/api` и `/admin` на API |

База засевается автоматически: роли, демо-аккаунты, каталог организатора, ТТХ роботов и фотографии — 229 решений, из них 80 с полными характеристиками. Повторный запуск данные не дублирует.

### Если порты заняты

```bash
cp .env.example .env
```

и поменять в `.env` значения `POSTGRES_PORT`, `API_PORT`, `WEB_PORT`.

### Остановить и запустить снова

```bash
docker compose down          # остановить, данные сохраняются
docker compose up -d         # запустить в фоне
docker compose down -v       # остановить и стереть базу (при следующем старте засеется заново)
```

---

## 3. Развёртывание на сервере

Проверено на Ubuntu 24.04 LTS, 1 vCPU / 2 ГБ RAM / 25 ГБ диска. Этого достаточно: в простое стенд занимает около 180 МБ памяти, под нагрузкой — 300–400 МБ.

### 3.1. Подготовка системы

```bash
apt-get update && apt-get upgrade -y
```

Подкачка на 2 ГБ — нужна не для работы, а для сборки фронтенда: она пикует под гигабайт и на голых двух гигабайтах может быть убита нехваткой памяти.

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Docker с официальным скриптом:

```bash
curl -fsSL https://get.docker.com | sh && docker --version
```

Файрвол — наружу только SSH и веб:

```bash
apt-get install -y ufw git
ufw allow 22/tcp && ufw allow 80/tcp && ufw --force enable
```

### 3.2. Код и настройки

```bash
git clone https://github.com/kromon3/robotics-platform.git /opt/robotics
cd /opt/robotics
```

Файл `.env` с секретами, которые генерируются прямо на сервере и никуда не передаются:

```bash
cat > .env <<EOF
POSTGRES_USER=robotics
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=robotics
POSTGRES_PORT=127.0.0.1:5432
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=1d
ADMIN_COOKIE_SECRET=$(openssl rand -hex 32)
API_PORT=127.0.0.1:3000
WEB_PORT=80
SEED_ADMIN_EMAIL=admin@robotics.local
SEED_ADMIN_PASSWORD=admin12345
SEED_MOCK_PASSWORD=password123
EOF
```

Два важных момента в этом файле:

- **`127.0.0.1` перед портами базы и API** — они слушают только петлевой интерфейс и недоступны из интернета. Docker публикует порты в обход ufw, поэтому ограничение задаётся именно здесь.
- **`WEB_PORT=80`** — приложение открывается по адресу без порта.

Демо-пароли на публичном стенде менять не нужно: они опубликованы в документации, жюри и проверяющие входят именно ими. Настоящих учётных записей на таком стенде заводить нельзя — соединение идёт по HTTP без шифрования.

### 3.3. Сборка и запуск

На одном ядре собирать образы по очереди, а не параллельно:

```bash
docker compose build api
docker compose build web
docker compose up -d
docker compose ps
```

Сборка занимает около 4 минут: API примерно 3, фронтенд около 40 секунд.

### 3.4. Проверка

```bash
curl -s -o /dev/null -w "SPA %{http_code}\n" http://localhost/
curl -s -o /dev/null -w "API %{http_code}\n" "http://localhost/api/catalog/products?limit=1"
curl -s -o /dev/null -w "admin %{http_code}\n" http://localhost/admin/login
docker compose logs api | grep -E "specs:|Админка готова"
```

Ожидается три ответа `200` и строка `specs: обновлено 80, добавлено 0; продуктов с ТТХ: 80`.

Сразу после старта API отвечает `502`: он накатывает миграции, засевает базу и собирает интерфейс админки — на одном ядре это до минуты. Дождаться строки `Nest application successfully started` в `docker compose logs -f api`.

### 3.5. Эксплуатация

```bash
docker compose logs -f web     # запросы: IP, путь, код ответа
docker compose logs -f api     # приложение: старт, ошибки, отказы входа в админку
docker stats                   # память и процессор
docker compose restart api     # перезапуск одного сервиса
```

Обновление до новой версии:

```bash
cd /opt/robotics && git pull
docker compose build api && docker compose build web
docker compose up -d
```

Все три сервиса помечены `restart: unless-stopped` — после перезагрузки сервера стенд поднимается сам.

Резервная копия базы и восстановление:

```bash
docker compose exec -T db pg_dump -U robotics robotics > backup.sql
docker compose exec -T db psql -U robotics robotics < backup.sql
```

---

## 4. Разработка без Docker

Нужны Node 22 и PostgreSQL. Базу проще поднять контейнером:

```bash
docker compose up -d db
```

Бэкенд:

```bash
cd apps/api
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Фронтенд:

```bash
cd apps/web/vite-project
npm ci
npm run dev
```

Адрес API для фронтенда задаётся в `apps/web/vite-project/.env` (`VITE_API_URL=http://localhost:3000`). В Docker-сборке он равен `/api` и проксируется nginx.

### Тесты

```bash
cd apps/web/vite-project && npx vitest run     # 71 тест: экономика, правила подбора, ранжирование, каталог стеллажей
cd apps/api && npx jest                        # тесты серверной части
```

36 тестов экономической модели воспроизводят контрольный пример документа экономистов до рубля.

---

## 5. Если что-то пошло не так

| Симптом | Причина и что делать |
|---|---|
| `API 502`, `admin 502` сразу после запуска | Контейнер ещё стартует: миграции, сид, сборка админки. Подождать минуту, смотреть `docker compose logs -f api` |
| Сборка обрывается со словом `Killed` | Не хватило памяти. Добавить подкачку (раздел 3.1) и собирать образы по очереди |
| `port is already allocated` | Порт занят другим процессом. Поменять `WEB_PORT`, `API_PORT` или `POSTGRES_PORT` в `.env` |
| Админка отвечает «нет соединения с базой» | База ещё не поднялась или упала: `docker compose ps`, затем `docker compose up -d db`. Следующий запрос к `/admin` подключится сам |
| В админку не пускает | Вход только для учётной записи с ролью `ADMIN`. Причина отказа пишется в `docker compose logs api` |
| Каталог пустой | Сид не отработал: `docker compose logs api \| grep catalog`. Пересеять — `docker compose exec api npx prisma db seed` |
| Изменения в коде не видны | Образы собираются из исходников: после `git pull` нужен `docker compose build` |

---

## 6. Состав поставки

| Путь | Что |
|---|---|
| `docker-compose.yml` | описание трёх сервисов, переменные и политика перезапуска |
| `apps/api` | серверная часть: NestJS, Prisma, миграции, сиды, данные каталога и фотографии |
| `apps/web/vite-project` | фронтенд, экономическая модель, имитация; Dockerfile с nginx |
| `.env.example` | образец файла настроек со всеми переменными |
| `docs/` | документация, демонстрационный сценарий, аудит по ТЗ, образец отчёта |
