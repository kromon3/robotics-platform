import 'dotenv/config';
import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
});
