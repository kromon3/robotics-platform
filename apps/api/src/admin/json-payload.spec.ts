import { parseScalar, unflattenDotted } from './json-payload';

describe('parseScalar', () => {
  it('приводит числа и булевы, остальное оставляет строкой', () => {
    expect(parseScalar('1500')).toBe(1500);
    expect(parseScalar('2.5')).toBe(2.5);
    expect(parseScalar('-3')).toBe(-3);
    expect(parseScalar('true')).toBe(true);
    expect(parseScalar('false')).toBe(false);
    expect(parseScalar('null')).toBeNull();
    expect(parseScalar('R-120')).toBe('R-120');
    expect(parseScalar('1.2.3')).toBe('1.2.3');
    expect(parseScalar('QR-метки, SLAM')).toBe('QR-метки, SLAM');
  });

  it('не трогает значения, которые уже не строки', () => {
    expect(parseScalar(42)).toBe(42);
    expect(parseScalar(null)).toBeNull();
  });
});

describe('unflattenDotted', () => {
  it('возвращает исходный объект, когда точек нет', () => {
    const params = { name: 'AMR 1500', price: '2200000' };
    expect(unflattenDotted(params)).toBe(params);
  });

  it('собирает specs.* в один объект и приводит типы', () => {
    const result = unflattenDotted({
      product_id: 'p1',
      name: 'AMR 1500',
      'specs.payload_kg': '1600',
      'specs.catalog_id': 'R-120',
      'specs.verified': 'true',
    });

    expect(result).toEqual({
      product_id: 'p1',
      name: 'AMR 1500',
      specs: { payload_kg: 1600, catalog_id: 'R-120', verified: true },
    });
    expect(Object.keys(result).some((key) => key.includes('.'))).toBe(false);
  });

  it('дополняет объект, пришедший вместе с плоскими ключами', () => {
    const result = unflattenDotted({
      specs: { photo: 'R-120.png', payload_kg: 1500 },
      'specs.payload_kg': '1600',
    });

    // Правка одного ключа не должна стирать остальные ТТХ
    expect(result.specs).toEqual({ photo: 'R-120.png', payload_kg: 1600 });
  });

  it('поддерживает вложенность глубже одного уровня', () => {
    const result = unflattenDotted({ 'econ.staff.count': '12' });
    expect(result).toEqual({ econ: { staff: { count: 12 } } });
  });

  it('не меняет переданный объект', () => {
    const params = { 'specs.payload_kg': '1600' };
    unflattenDotted(params);
    expect(params).toEqual({ 'specs.payload_kg': '1600' });
  });
});
