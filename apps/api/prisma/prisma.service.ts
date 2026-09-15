// prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL;

    if (!url || typeof url !== 'string') {
      throw new Error(
          'DATABASE_URL is not set or is not a string. Make sure to load .env (import "dotenv/config") and that .env contains DATABASE_URL.',
      );
    }

    const adapter = new PrismaPg({
      connectionString: url,
    });

    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Successfully connected to PostgreSQL database');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('✅ Successfully disconnected from PostgreSQL database');
    } catch (error) {
      this.logger.error('❌ Failed to disconnect from database', error);
    }
  }
}