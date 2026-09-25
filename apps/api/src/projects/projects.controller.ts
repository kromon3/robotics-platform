import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type RequestUser } from '../auth/auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

type AuthedRequest = { user: RequestUser };

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Сохранить расчёт', description: 'Параметры объекта, экономика, робот и итоги' })
  create(@Req() req: AuthedRequest, @Body() dto: CreateProjectDto) {
    return this.projects.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Мои расчёты', description: 'Список с итогами, новые сверху' })
  findAll(@Req() req: AuthedRequest) {
    return this.projects.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Открыть расчёт', description: 'Полные параметры для восстановления формы' })
  findOne(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить расчёт' })
  update(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить расчёт' })
  remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(req.user.id, id);
  }
}
