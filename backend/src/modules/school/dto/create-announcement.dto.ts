import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Données pour créer une annonce ciblée émise par une école.
 * Le ciblage (targetType) détermine quels champs complémentaires sont pertinents :
 * CLASSES -> classes, STUDENTS -> studentIds, TEACHERS -> teacherIds,
 * ALL_STUDENTS/EVERYONE -> aucun champ complémentaire nécessaire.
 */
export class CreateAnnouncementDto {
  /** Titre de l'annonce. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  /** Contenu détaillé de l'annonce. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  /** Type de cible de diffusion (détermine quels champs de ciblage ci-dessous sont utilisés). */
  @IsString()
  @IsIn(['ALL_STUDENTS', 'CLASSES', 'STUDENTS', 'TEACHERS', 'EVERYONE'])
  targetType: string;

  /** Noms des classes ciblées, pertinent uniquement si targetType = CLASSES. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classes?: string[];

  /** Identifiants des étudiants ciblés individuellement, pertinent uniquement si targetType = STUDENTS. */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  studentIds?: string[];

  /** Identifiants des enseignants ciblés individuellement, pertinent uniquement si targetType = TEACHERS. */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  teacherIds?: string[];
}
