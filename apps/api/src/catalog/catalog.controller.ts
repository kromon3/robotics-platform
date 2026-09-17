import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { ProductsQueryDto } from './dto/products-query.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Список продуктов каталога',
    description:
      'Фильтры через query: type, status, category, industry, scenario, q (поиск по названию), page, limit',
  })
  async getAllProducts(@Query() query: ProductsQueryDto) {
    return await this.catalogService.getAllProducts(query);
  }
}
