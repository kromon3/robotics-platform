import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Patch,
  UseGuards,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserDto } from './dto/user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Получение все пользователей',
  })
  async getAll() {
    const users = await this.usersService.getAll();
    return users.map(({ password, ...user }) => user);
  }
  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: ' Получение пользователя по его id ',
  })
  async getById(@Param('id') id: string): Promise<any> {
    const user = await this.usersService.getById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const { password, ...result } = user;
    return result;
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Создание пользователя',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'admin',
        },
        email: {
          type: 'string',
          example: 'admin@gmail.com',
        },
        password: {
          type: 'string',
          example: '123456789',
        },
      },
    },
  })
  async createUser(@Body() userDto: UserDto): Promise<any> {
    const user = await this.usersService.create(userDto);
    const { password, ...result } = user;
    return result;
  }
  @Post('email')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: ' Получение пользователя по его email ',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'exampl@mail.ru' },
      },
    },
  })
  async getByEmail(@Body('email') email: string): Promise<any> {
    const user = await this.usersService.getByEmail(email);
    const { password, ...result } = user;
    return result;
  }
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Удаление по id ',
  })
  async deleteById(@Param('id') id: string, @Req() req) {
    if (req.user.id !== id) {
      throw new ForbiddenException('You can only delete your own profile');
    }
    const deleted = await this.usersService.deleteById(id);
    const { password, ...result } = deleted;
    return result;
  }
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Обновление пользователя по id',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'aa@mail.ru' },
        name: { type: 'string', example: 'aa' },
        avatar: {
          type: 'string',
          example: 'https://example.com/avatars/aa-new.jpg',
        },
      },
    },
  })
  async updateUser(
    @Body() userDto: UpdateUserDto,
    @Param('id') id: string,
    @Req() req,
  ): Promise<any> {
    if (req.user.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    const updatedUser = await this.usersService.update(userDto, id);
    const { password, ...result } = updatedUser;
    return result;
  }
}
