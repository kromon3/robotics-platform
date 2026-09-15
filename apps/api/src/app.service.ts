import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  constructor() {
  }
  getHello(): string {
    return '<h1>Hello world</h1>';
  }
}
