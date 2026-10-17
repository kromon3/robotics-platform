import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type RequestUser } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-auth.guard';
import { QuoteRequestsService } from './quote-requests.service';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto';
import {
  QuoteRequestsQueryDto,
  UpdateQuoteStatusDto,
} from './dto/quote-requests-query.dto';

@ApiTags('Quote requests')
@Controller('quote-requests')
export class QuoteRequestsController {
  constructor(private readonly quotes: QuoteRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Запросить КП',
    description:
      'Публичный: гость может отправить запрос коммерческого предложения по 1–10 решениям каталога. ' +
      'Позиции группируются по поставщикам. Если передан Bearer-токен — запрос привязывается к пользователю.',
  })
  create(
    @Body() dto: CreateQuoteRequestDto,
    @Ip() ip: string,
    @Req() req: { user?: RequestUser },
  ) {
    return this.quotes.create(dto, { ip, userId: req.user?.id ?? null });
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Запросы КП (администратор)',
    description: 'Новые сверху; фильтр status, пагинация page/limit',
  })
  findAll(@Query() query: QuoteRequestsQueryDto) {
    return this.quotes.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Запрос КП целиком (администратор)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Сменить статус запроса КП (администратор)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteStatusDto,
  ) {
    return this.quotes.updateStatus(id, dto.status);
  }
}
