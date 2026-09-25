import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedCatalog } from './seed-catalog';
import { seedRobotSpecs } from './seed-specs';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// Демо-аккаунты для проверки (п. 8.2.5 ТЗ). Переопределяются через env в docker-compose.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@robotics.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
const USER_EMAIL = process.env.SEED_USER_EMAIL ?? 'user@robotics.local';
const USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'user12345';

// Сид идемпотентный (upsert) — запускается при каждом старте контейнера.
async function seedRoles() {
  await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      description: 'Роль по умолчанию для каждого зарегистрированного пользователя',
      permissions: [],
      priority: 0,
    },
  });
  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Полный административный доступ: управление каталогом и нормативами',
      permissions: [],
      priority: 100,
    },
  });
}

async function upsertUser(
  email: string,
  name: string,
  password: string,
  roleName: 'USER' | 'ADMIN',
) {
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash },
    create: { email, name, password: hash },
  });

  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  return user;
}

async function main() {
  await seedRoles();
  await upsertUser(ADMIN_EMAIL, 'administrator', ADMIN_PASSWORD, 'ADMIN');
  await upsertUser(USER_EMAIL, 'demo_user', USER_PASSWORD, 'USER');

  console.log('✅ Seed завершён');
  console.log(`   admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`   user:  ${USER_EMAIL} / ${USER_PASSWORD}`);

  await seedCatalog(prisma);
  await seedRobotSpecs(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
