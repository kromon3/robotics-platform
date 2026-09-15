// update-user.dto.ts
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Невалидный email' })
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Имя пользователя должно быть от 8 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Пароль должен быть от 8 символов' })
  password?: string;

  @IsOptional()
  @IsString({ message: 'Аватар должен быть строкой' })
  avatar?: string;
}
