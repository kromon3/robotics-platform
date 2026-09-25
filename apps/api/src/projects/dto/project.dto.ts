import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// Итоги расчёта сохраняются вместе с исходными данными, чтобы список проектов
// показывался без пересчёта, а сам расчёт воспроизводился по params/econ/norms.
export class CreateProjectDto {
  @ApiProperty({ example: 'Склад на Ленинградке' })
  @IsString()
  @IsNotEmpty({ message: 'Введите название расчёта' })
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ enum: ['warehouse', 'airport', 'medical'], default: 'warehouse' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  objectType?: string;

  @ApiProperty({ description: 'Параметры объекта (фаза 1 визарда)' })
  @IsObject()
  params: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Данные экономики (фаза 2 визарда)' })
  @IsOptional()
  @IsObject()
  econ?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Нормативы модели на момент расчёта' })
  @IsOptional()
  @IsObject()
  norms?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Выбранное решение из каталога' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) robotsCount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() capex?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() opexPerYear?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() annualEffect?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() paybackYears?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() roiPercent?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() tco?: number;

  @ApiPropertyOptional({ default: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  catalogVersion?: number;

  @ApiPropertyOptional({ default: 'v2' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  modelVersion?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
