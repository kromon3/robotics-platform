import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Все фильтры приходят в query string: GET /catalog/products?type=brs&industry=ЖКХ&page=2
// ValidationPipe({ transform: true }) сам приводит page/limit из строки в число.
export class ProductsQueryDto {
    @IsOptional()
    @ApiPropertyOptional()
    @IsIn(['brs', 'bas', 'software'])
    type?: string;
    @ApiPropertyOptional()
    @IsOptional()
    @IsIn(['operation', 'piloting', 'rnd'])
    status?: string;

    // Категория продукта ("Мобильные роботы", "Морские роботы", ...)
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string;

    // Название отрасли / сценария из справочников
    @IsOptional()
    @ApiPropertyOptional()
    @IsString()
    industry?: string;

    @IsOptional()
    @ApiPropertyOptional()
    @IsString()
    scenario?: string;

    // Поиск по названию, без учёта регистра
    @IsOptional()
    @ApiPropertyOptional()
    @IsString()
    q?: string;

    // Сортировка; без параметра — по названию
    @IsOptional()
    @ApiPropertyOptional({ enum: ['price_asc', 'price_desc', 'ugt_desc', 'name'] })
    @IsIn(['price_asc', 'price_desc', 'ugt_desc', 'name'])
    sort?: 'price_asc' | 'price_desc' | 'ugt_desc' | 'name';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @ApiPropertyOptional()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @ApiPropertyOptional()
    @Min(1)
    @Max(100)
    limit: number = 20;
}