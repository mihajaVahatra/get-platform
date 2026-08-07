import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPendingReminderDto {
  @ApiPropertyOptional({
    example: 3,
    description:
      "Nombre de jours sans mise à jour au-delà duquel une candidature encore ouverte est considérée en attente de relance.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  staleDays?: number = 3;
}
