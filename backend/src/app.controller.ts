import { Controller, Get, Head, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Nest ne répond pas automatiquement au HEAD pour une route @Get() (contrairement
  // à Express seul) — la sonde de démarrage de Render fait un HEAD / avant de
  // déclarer le service "Live", d'où un 404 systématique sans cette route.
  @Public()
  @Head()
  @HttpCode(200)
  headRoot(): void {}
}
