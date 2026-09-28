import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { importESM } from './esm';
import { adminResources } from './resources';
import { unflattenDotted } from './json-payload';

// Админка каталога (ТЗ 3.1.4, 3.3.5) на AdminJS.
//
// Адаптер — @adminjs/sql, а не @adminjs/prisma: последний поддерживает Prisma 5–6,
// здесь же Prisma 7 с генератором prisma-client и собственным output, где нет DMMF.
// SQL-адаптер читает схему прямо из Postgres через knex, поэтому не зависит от версии
// Prisma и подхватывает новые таблицы после миграций сам.
//
// Вход — по учёткам приложения: e-mail и пароль из таблицы User, пускаем только роль ADMIN.
// Роутер монтируется в существующее приложение Nest, без @adminjs/nestjs: тот пакет тоже
// ESM-only и требует собирать модуль асинхронно, что в CJS-сборке лишняя сложность.

export const ADMIN_ROOT = '/admin';

const logger = new Logger('AdminJS');

const cookieSecret = () =>
  process.env.ADMIN_COOKIE_SECRET ?? process.env.JWT_SECRET ?? 'change-me';

/** Проверка входа: пароль из User + обязательная роль ADMIN */
function authenticateWith(prisma: PrismaService) {
  return async (email: string, password: string) => {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { UserRole: { include: { role: true } } },
    });
    if (!user) return null;

    if (!(await bcrypt.compare(password, user.password))) return null;

    const isAdmin = user.UserRole.some((userRole) => userRole.role.name === 'ADMIN');
    if (!isAdmin) {
      logger.warn(`Вход в админку отклонён: у ${email} нет роли ADMIN`);
      return null;
    }

    // Попадает в сессию и показывается в шапке админки
    return { id: user.id, email: user.email, title: user.name };
  };
}

/**
 * Поднимает AdminJS на ADMIN_ROOT. Ошибки не валят приложение: админка —
 * вспомогательный инструмент, REST API должен подняться в любом случае.
 */
export async function setupAdmin(app: INestApplication): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL не задан — админка не поднята');
    return;
  }

  try {
    const { default: AdminJS } = await importESM<typeof import('adminjs')>('adminjs');
    const { Adapter, Database, Resource } = await importESM<typeof import('@adminjs/sql')>('@adminjs/sql');
    const AdminJSExpress = await importESM<typeof import('@adminjs/express')>('@adminjs/express');

    // AdminJS перед записью «расплющивает» вложенные объекты обратно в specs.payload_kg,
    // поэтому собирать их надо в самом адаптере, прямо перед knex.
    class JsonAwareResource extends (Resource as any) {
      async update(id: string, params: Record<string, unknown>) {
        return super.update(id, unflattenDotted(params));
      }
      async create(params: Record<string, unknown>) {
        return super.create(unflattenDotted(params));
      }
    }

    AdminJS.registerAdapter({ Database, Resource: JsonAwareResource as unknown as typeof Resource });

    const db = await new Adapter('postgresql', {
      connectionString: databaseUrl,
      database: new URL(databaseUrl).pathname.replace(/^\//, ''),
    }).init();

    const admin = new AdminJS({
      rootPath: ADMIN_ROOT,
      resources: adminResources(db),
      branding: {
        companyName: 'Платформа роботизации',
        withMadeWithLove: false,
      },
    });

    const router = AdminJSExpress.buildAuthenticatedRouter(
      admin,
      {
        authenticate: authenticateWith(app.get(PrismaService)),
        cookieName: 'adminjs',
        cookiePassword: cookieSecret(),
      },
      null,
      {
        resave: false,
        saveUninitialized: false,
        secret: cookieSecret(),
        cookie: { httpOnly: true, sameSite: 'lax' },
      },
    );

    app.use(ADMIN_ROOT, router);
    logger.log(`🛠️  Админка: http://localhost:${process.env.PORT ?? 3000}${ADMIN_ROOT}`);
  } catch (error) {
    logger.error(`Админка не поднялась: ${error instanceof Error ? error.message : error}`);
  }
}
