import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Невалидный email' })
  @IsNotEmpty({ message: 'Введите email' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Введите пароль' })
  @MinLength(8, { message: 'Пароль должен быть от 8 символов' })
  password: string;
}
