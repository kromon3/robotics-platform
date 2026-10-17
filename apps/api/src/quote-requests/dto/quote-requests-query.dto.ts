import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteRequestStatus } from '../../../generated/prisma/enums';

export class QuoteRequestsQueryDto {
  @ApiPropertyOptional({ enum: QuoteRequestStatus })
  @IsOptional()
  @IsEnum(QuoteRequestStatus)
  status?: QuoteRequestStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateQuoteStatusDto {
  @ApiPropertyOptional({ enum: QuoteRequestStatus })
  @IsEnum(QuoteRequestStatus, { message: 'Неизвестный статус' })
  status: QuoteRequestStatus;
}
