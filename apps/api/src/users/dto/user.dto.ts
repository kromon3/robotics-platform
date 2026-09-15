import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UserDto {
  id?: string;
  @IsEmail({}, { message: 'Невалидный email' })
  @IsNotEmpty({ message: 'Введите email' })
  @IsString()
  email: string;
  @IsString()
  @IsNotEmpty({ message: 'Введите имя' })
  @MinLength(6, { message: 'Имя пользователя должно быть от 6 символов' })
  name: string;
  @IsString()
  @IsNotEmpty({ message: 'Введите пароль' })
  @MinLength(8, { message: 'Пароль должен быть от 8 символов' })
  password: string;
  @IsOptional()
  @IsString({ message: 'Аватар должен быть строкой' })
  avatar?: string;
}
