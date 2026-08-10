import { ApiProperty } from '@nestjs/swagger';

/** Métadonnées de pagination renvoyées avec une liste paginée. */
export class MetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

/**
 * Enveloppe standard de toutes les réponses HTTP de l'API (voir `ResponseInterceptor`).
 * `data` porte le contenu métier réel de la réponse, `meta` n'est présent que pour
 * les listes paginées.
 */
export class BaseResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation successful' })
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty({ type: MetaDto, required: false })
  meta?: MetaDto;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  timestamp: Date;

  @ApiProperty({ example: 200 })
  statusCode: number;
}
