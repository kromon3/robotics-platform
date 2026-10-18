import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto';

const PRODUCT = '0199a3b2-7c1e-7f00-8000-000000000001';

const valid = {
  contactName: 'Иван Петров',
  company: 'ООО «Склад»',
  email: 'zakupki@sklad.ru',
  deliveryRegion: 'Подольск',
  timeframe: '1-3m',
  consent: true,
  items: [{ productId: PRODUCT, quantity: 2 }],
};

async function errorsOf(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateQuoteRequestDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return Object.fromEntries(
    errors.map((e) => [
      e.property,
      Object.values(e.constraints ?? {}).concat(
        (e.children ?? []).flatMap((c) =>
          (c.children ?? []).flatMap((cc) =>
            Object.values(cc.constraints ?? {}),
          ),
        ),
      ),
    ]),
  );
}

describe('CreateQuoteRequestDto', () => {
  it('минимальный запрос гостя проходит', async () => {
    expect(await errorsOf(valid)).toEqual({});
  });

  it('необязательные поля проверяются, если заполнены', async () => {
    expect(
      await errorsOf({
        ...valid,
        phone: '+7 (999) 123-45-67',
        inn: '7707083893',
        comment: 'две смены',
        source: 'compare',
      }),
    ).toEqual({});
    const errors = await errorsOf({
      ...valid,
      phone: 'позвоните',
      inn: '1234567890',
    });
    expect(errors.phone).toContain('Укажите корректный телефон');
    expect(errors.inn[0]).toMatch(/ИНН/);
  });

  it('без согласия на обработку ПДн запрос не принимается', async () => {
    expect((await errorsOf({ ...valid, consent: false })).consent).toContain(
      'Нужно согласие на обработку персональных данных',
    );
    expect(
      (await errorsOf({ ...valid, consent: undefined })).consent,
    ).toBeDefined();
  });

  it('обязательные поля и формат email', async () => {
    const errors = await errorsOf({
      ...valid,
      contactName: '',
      email: 'не-почта',
      deliveryRegion: '',
      timeframe: 'вчера',
    });
    expect(Object.keys(errors).sort()).toEqual(
      ['contactName', 'deliveryRegion', 'email', 'timeframe'].sort(),
    );
  });

  it('позиции: хотя бы одна, количество — целое от 1', async () => {
    expect((await errorsOf({ ...valid, items: [] })).items).toContain(
      'Выберите хотя бы одно решение',
    );
    const errors = await errorsOf({
      ...valid,
      items: [{ productId: 'R-101', quantity: 0 }],
    });
    expect(errors.items).toEqual(
      expect.arrayContaining([
        'Неизвестное решение',
        'Количество — не меньше 1',
      ]),
    );
  });

  it('лишние поля отклоняются, ловушка для ботов — разрешённое поле', async () => {
    expect(await errorsOf({ ...valid, website: 'http://spam' })).toEqual({});
    expect((await errorsOf({ ...valid, isAdmin: true })).isAdmin).toBeDefined();
  });

  it('все сообщения об ошибках — по-русски (их видит пользователь)', async () => {
    const wrong = {
      contactName: 1,
      company: 'x'.repeat(201),
      email: 2,
      phone: 3,
      inn: 4,
      comment: 5,
      deliveryRegion: 6,
      timeframe: 'soon',
      consent: 'yes',
      consentVersion: 7,
      items: Array.from({ length: 11 }, () => ({
        productId: 'x',
        quantity: 0,
      })),
      source: 'mail',
      website: 8,
    };
    const messages = [
      ...Object.values(await errorsOf(wrong)).flat(),
      ...Object.values(await errorsOf({ items: 'x' })).flat(),
    ];
    expect(messages.length).toBeGreaterThan(15);
    // Стандартные сообщения class-validator — английские: «must be», «each value…»
    expect(
      messages.filter((m) => /must|should|each|value|property/i.test(m)),
    ).toEqual([]);
  });
});
