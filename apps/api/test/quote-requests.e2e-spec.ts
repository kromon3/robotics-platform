import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../prisma/prisma.service';
import { QuoteRateLimiter } from './../src/quote-requests/rate-limiter';

// Сквозной сценарий снабженца на настоящей базе (DATABASE_URL из .env, каталог засеян):
// гость запрашивает КП по решениям двух поставщиков, администратор видит запрос.
// Записи теста помечены доменом @e2e.test и удаляются после прогона.

const EMAIL = 'snab@e2e.test';

describe('Запросы КП (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const limiter = new QuoteRateLimiter(1000, 60_000);
  let products: { id: string; name: string; companyId: string }[] = [];
  let adminToken: string;
  let userToken: string;

  const base = () => ({
    contactName: 'Иван Петров',
    company: 'ООО «Склад»',
    email: EMAIL,
    deliveryRegion: 'Подольск',
    timeframe: '1-3m',
    consent: true,
    items: [
      { productId: products[0].id, quantity: 2 },
      { productId: products[1].id, quantity: 1 },
    ],
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QuoteRateLimiter)
      .useValue(limiter)
      .compile();

    app = moduleFixture.createNestApplication();
    // Как в main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    // Два решения разных поставщиков
    const all = await prisma.product.findMany({
      select: { id: true, name: true, companyId: true },
      orderBy: { name: 'asc' },
      take: 50,
    });
    const first = all[0];
    const second = all.find((p) => p.companyId !== first.companyId);
    if (!second) throw new Error('В каталоге нужен второй поставщик');
    products = [first, second];

    const login = (email: string, password: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .then((r) => (r.body as { token: string }).token);
    const admin = await login('admin@robotics.local', 'admin12345');
    const user = await login('user@robotics.local', 'user12345');
    adminToken = admin;
    userToken = user;
    if (!adminToken || !userToken)
      throw new Error('Нет демо-аккаунтов: npx prisma db seed');
  });

  afterAll(async () => {
    await prisma.quoteRequest.deleteMany({
      where: { email: { endsWith: '@e2e.test' } },
    });
    await app.close();
  });

  let createdId: string;

  it('гость отправляет запрос — части по поставщикам и снимок каталога', async () => {
    const res = await request(app.getHttpServer())
      .post('/quote-requests')
      .send({ ...base(), source: 'compare' })
      .expect(201);

    const body = res.body as {
      id: string;
      displayNumber: string;
      status: string;
      suppliers: {
        companyName: string;
        items: { productName: string; quantity: number }[];
      }[];
    };
    expect(body.displayNumber).toMatch(/^\d{6}$/);
    expect(body.status).toBe('NEW');
    expect(body.suppliers).toHaveLength(2);
    createdId = body.id;

    const saved = await prisma.quoteRequest.findUniqueOrThrow({
      where: { id: createdId },
      include: { suppliers: { include: { items: true } } },
    });
    expect(saved.userId).toBeNull();
    expect(saved.consentGiven).toBe(true);
    expect(saved.consentAt).toBeInstanceOf(Date);
    const names = saved.suppliers
      .flatMap((s) => s.items.map((i) => i.productName))
      .sort();
    expect(names).toEqual(products.map((p) => p.name).sort());
  });

  it('без согласия и с ошибками в полях — 400 с понятными сообщениями', async () => {
    const res = await request(app.getHttpServer())
      .post('/quote-requests')
      .send({ ...base(), consent: false, email: 'не-почта', inn: '1234567890' })
      .expect(400);
    const message = (res.body as { message: string[] }).message.join(' | ');
    expect(message).toContain(
      'Нужно согласие на обработку персональных данных',
    );
    expect(message).toContain('Укажите корректный email');
    expect(message).toMatch(/ИНН/);
  });

  it('неизвестное решение — 400', async () => {
    await request(app.getHttpServer())
      .post('/quote-requests')
      .send({
        ...base(),
        items: [
          { productId: '0199a3b2-7c1e-7f00-8000-000000000001', quantity: 1 },
        ],
      })
      .expect(400);
  });

  it('ловушка для ботов: 201, но в базе ничего нет', async () => {
    const before = await prisma.quoteRequest.count({ where: { email: EMAIL } });
    const res = await request(app.getHttpServer())
      .post('/quote-requests')
      .send({ ...base(), website: 'http://spam.example' })
      .expect(201);
    expect((res.body as { number: number }).number).toBe(0);
    expect(await prisma.quoteRequest.count({ where: { email: EMAIL } })).toBe(
      before,
    );
  });

  it('из аккаунта запрос привязывается к пользователю', async () => {
    const res = await request(app.getHttpServer())
      .post('/quote-requests')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        ...base(),
        items: [{ productId: products[0].id, quantity: 1 }],
        source: 'detail',
      })
      .expect(201);
    const saved = await prisma.quoteRequest.findUniqueOrThrow({
      where: { id: (res.body as { id: string }).id },
    });
    expect(saved.userId).not.toBeNull();
  });

  it('протухший токен не мешает гостю отправить запрос', async () => {
    await request(app.getHttpServer())
      .post('/quote-requests')
      .set('Authorization', 'Bearer not-a-token')
      .send(base())
      .expect(201);
  });

  it('список и карточка — только администратору', async () => {
    await request(app.getHttpServer()).get('/quote-requests').expect(401);
    await request(app.getHttpServer())
      .get('/quote-requests')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/quote-requests?status=NEW&limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const ids = (list.body as { items: { id: string }[] }).items.map(
      (i) => i.id,
    );
    expect(ids).toContain(createdId);

    const one = await request(app.getHttpServer())
      .get(`/quote-requests/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((one.body as { email: string }).email).toBe(EMAIL);
  });

  it('администратор меняет статус', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/quote-requests/${createdId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SENT' })
      .expect(200);
    expect((res.body as { status: string }).status).toBe('SENT');
  });

  it('лимит запросов — 429', async () => {
    jest.spyOn(limiter, 'take').mockReturnValueOnce(false);
    await request(app.getHttpServer())
      .post('/quote-requests')
      .send(base())
      .expect(429);
  });
});
