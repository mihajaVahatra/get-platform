import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const SETTINGS_KEY = 'platform.settings';

const DEFAULTS = {
  platformName: 'GET – Grandes Écoles de Tananarive et de Madagascar',
  contactEmail: 'contact@get.mg',
  contactPhone: '+261 34 12 345 67',
  address: 'Lot II 4B, Antananarivo, Madagascar',
};

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: SETTINGS_KEY } });
    return { ...DEFAULTS, ...(row?.value as object) };
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    await this.prisma.systemConfig.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: dto as unknown as Prisma.InputJsonValue },
      update: { value: dto as unknown as Prisma.InputJsonValue },
    });
    return this.getSettings();
  }
}
