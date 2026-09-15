import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}
  @Get()
  @ApiOperation({
    summary: 'Получение всех ролей',
    description: 'Возвращает список всех ролей в системе',
  })
  async getAllRoles() {
    return this.roleService.findAll();
  }
  @Get('name')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: ' Поиск роли по названию ',
    description: ' Ищет роль по ее названию ',
  })
  async getByName(@Query('name') name: string): Promise<any> {
    return this.roleService.findByName(name);
  }
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: ' Роль пользователя ',
    description: ' Ищет роль пользлователя по его id',
  })
  async getUserRoles(
    @Param('id') id: string,
    @Request() req,
  ): Promise<string[]> {
    if (req.user.id !== id) {
      throw new ForbiddenException('Cannot access other users role');
    }
    return this.roleService.getUserRoles(id);
  }
  @Post('assignRole')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: ' Добавление ролей ',
    description: ' Добавляет роль пользователю по userId и roleName',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          example: '019fb76d-7de9-7234-b5f9-c720ecc7eb09',
        },
        roleName: { type: 'string', example: 'ADMIN' },
      },
    },
  })
  async assignRole(@Body() role: { userId: string; roleName: string }) {
    return this.roleService.assignRole(role.userId, role.roleName);
  }
  @Delete('revokeRole')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Удаление Роли',
    description: 'Удаляет роль у пользователя по userId и roleName',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          example: '019fb76d-7de9-7234-b5f9-c720ecc7eb09',
        },
        roleName: { type: 'string', example: 'ADMIN' },
      },
    },
  })
  async deleteRole(@Body() role: { userId: string; roleName: string }) {
    return this.roleService.revokeRole(role.userId, role.roleName);
  }
}
