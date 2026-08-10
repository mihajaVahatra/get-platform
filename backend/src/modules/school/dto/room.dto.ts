import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Types de salle disponibles pour une école (utilisé pour la génération d'emploi du temps). */
export const ROOM_TYPES = ['STANDARD', 'LAB', 'AMPHI', 'SPORT'] as const;

/** Données pour créer une salle physique d'une école. */
export class CreateRoomDto {
  /** Nom/numéro de la salle. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  /** Capacité d'accueil maximale de la salle (nombre de places). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  capacity?: number;

  /** Type de salle (parmi ROOM_TYPES), utile pour orienter l'affectation lors de la génération d'emploi du temps. */
  @IsOptional()
  @IsIn(ROOM_TYPES)
  type?: string;

  /** Active ou désactive la salle sans la supprimer (une salle inactive n'est plus proposée). */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Données pour mettre à jour une salle existante (tous les champs optionnels). */
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
