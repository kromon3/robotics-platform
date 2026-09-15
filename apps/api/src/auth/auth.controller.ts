import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';

import { UserDto } from '../users/dto/user.dto';
import { LoginDto } from './dto/login.dto';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, RequestUser } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'exampl@mail.ru' },
        password: { type: 'string', example: 'aksfkaapof' },
        name: { type: 'string', example: 'example1' },
      },
    },
  })
  @ApiOperation({
    description: ' Регистрация пользователя по имени email и пароле',
    summary: 'Регистрация',
  })
  async register(@Body() userDto: UserDto) {
    return this.authService.register(userDto);
  }
  @Post('login')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'exampl@mail.ru' },
        password: { type: 'string', example: 'aksfkaapof' },
      },
    },
  })
  @ApiOperation({
    description: ' Получение JWT по email password',
    summary: 'Логин',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    description: 'Текущий пользователь по Bearer-токену: id, email, name, roles',
    summary: 'Кто я',
  })
  me(@Req() req: { user: RequestUser }): RequestUser {
    return req.user;
  }
}
