import { IsEmail, IsInt, IsUUID, Min } from 'class-validator';

/** Données pour inscrire un étudiant (identifié par email) dans un programme d'une école pour une année académique donnée. */
export class EnrollStudentDto {
  /** Email de l'étudiant à inscrire (sert d'identifiant, l'étudiant peut ne pas encore avoir de compte). */
  @IsEmail()
  email: string;

  /** Programme (filière/diplôme) dans lequel inscrire l'étudiant. */
  @IsUUID()
  programId: string;

  /** Niveau/année du programme auquel l'étudiant est inscrit. */
  @IsInt()
  @Min(1)
  level: number;

  /** Année académique concernée par l'inscription. */
  @IsUUID()
  academicYearId: string;
}
