import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { isValidInn } from '../inn';

export const QUOTE_TIMEFRAMES = [
  'asap',
  '1-3m',
  '3-6m',
  '6-12m',
  'exploring',
] as const;
export const QUOTE_SOURCES = ['compare', 'detail'] as const;
/** Больше позиций в одном запросе не бывает: из сравнения приходит до трёх */
export const QUOTE_MAX_ITEMS = 10;
export const QUOTE_MAX_QUANTITY = 10_000;

@ValidatorConstraint({ name: 'inn' })
class InnConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidInn(value);
  }
  defaultMessage(args: { value: unknown }) {
    return /^\d{10}$|^\d{12}$/.test(String(args.value))
      ? 'Такого ИНН не существует: контрольные цифры не сходятся'
      : 'ИНН — это 10 цифр у организации или 12 у ИП, без пробелов и букв';
  }
}

export class QuoteItemDto {
  @ApiProperty({ example: '0199a3b2-7c1e-7f00-8000-000000000001' })
  @IsUUID('all', { message: 'Неизвестное решение' })
  productId: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: QUOTE_MAX_QUANTITY })
  @Type(() => Number)
  @IsInt({ message: 'Количество — целое число' })
  @Min(1, { message: 'Количество — не меньше 1' })
  @Max(QUOTE_MAX_QUANTITY, {
    message: `Количество — не больше ${QUOTE_MAX_QUANTITY}`,
  })
  quantity: number;
}

// Запрос КП от снабженца. Вход не нужен: контакт — в самом запросе.
export class CreateQuoteRequestDto {
  @ApiProperty({ example: 'Иван Петров' })
  @IsString({ message: 'Контактное лицо: ожидается строка' })
  @IsNotEmpty({ message: 'Укажите контактное лицо' })
  @MaxLength(150, { message: 'Контактное лицо: не длиннее 150 символов' })
  contactName: string;

  @ApiProperty({ example: 'ООО «Склад-Логистик»' })
  @IsString({ message: 'Компания: ожидается строка' })
  @IsNotEmpty({ message: 'Укажите компанию' })
  @MaxLength(200, { message: 'Компания: не длиннее 200 символов' })
  company: string;

  @ApiProperty({ example: 'zakupki@sklad.ru' })
  @IsEmail({}, { message: 'Укажите корректный email' })
  @MaxLength(254, { message: 'Email: не длиннее 254 символов' })
  email: string;

  @ApiPropertyOptional({ example: '+7 999 123-45-67' })
  @IsOptional()
  @IsString({ message: 'Телефон: ожидается строка' })
  @Matches(/^\+?[\d\s()-]{6,30}$/, { message: 'Укажите корректный телефон' })
  phone?: string;

  @ApiPropertyOptional({ example: '7707083893' })
  @IsOptional()
  @IsString({ message: 'ИНН: ожидается строка' })
  @Validate(InnConstraint)
  inn?: string;

  @ApiPropertyOptional({
    example: 'Нужна интеграция с WMS, работа в две смены',
  })
  @IsOptional()
  @IsString({ message: 'Комментарий: ожидается строка' })
  @MaxLength(2000, { message: 'Комментарий: не длиннее 2000 символов' })
  comment?: string;

  @ApiProperty({ example: 'Московская область, Подольск' })
  @IsString({ message: 'Регион поставки: ожидается строка' })
  @IsNotEmpty({ message: 'Укажите регион или город поставки' })
  @MaxLength(150, { message: 'Регион поставки: не длиннее 150 символов' })
  deliveryRegion: string;

  @ApiProperty({ enum: QUOTE_TIMEFRAMES, example: '1-3m' })
  @IsIn(QUOTE_TIMEFRAMES, { message: 'Выберите желаемый срок' })
  timeframe: (typeof QUOTE_TIMEFRAMES)[number];

  @ApiProperty({
    example: true,
    description: 'Согласие на обработку персональных данных',
  })
  @IsBoolean({ message: 'Нужно согласие на обработку персональных данных' })
  @Equals(true, {
    message: 'Нужно согласие на обработку персональных данных',
  })
  consent: boolean;

  @ApiPropertyOptional({
    example: '2026-10-17',
    description:
      'Редакция уведомления об обработке ПДн, с которой согласился пользователь',
  })
  @IsOptional()
  @IsString({ message: 'Редакция согласия: ожидается строка' })
  @MaxLength(30, { message: 'Редакция согласия: не длиннее 30 символов' })
  consentVersion?: string;

  @ApiProperty({ type: [QuoteItemDto] })
  @IsArray({ message: 'Выберите хотя бы одно решение' })
  @ArrayMinSize(1, { message: 'Выберите хотя бы одно решение' })
  @ArrayMaxSize(QUOTE_MAX_ITEMS, {
    message: `Не больше ${QUOTE_MAX_ITEMS} решений в одном запросе`,
  })
  @ValidateNested({ each: true, message: 'Неверный формат позиций' })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];

  @ApiPropertyOptional({ enum: QUOTE_SOURCES })
  @IsOptional()
  @IsIn(QUOTE_SOURCES, { message: 'Неизвестный источник запроса' })
  source?: (typeof QUOTE_SOURCES)[number];

  // Ловушка для ботов: поле скрыто от людей, живой пользователь его не заполняет
  @ApiPropertyOptional({ description: 'Не заполнять (защита от спама)' })
  @IsOptional()
  @IsString({ message: 'Поле: ожидается строка' })
  @MaxLength(200, { message: 'Поле: не длиннее 200 символов' })
  website?: string;
}
