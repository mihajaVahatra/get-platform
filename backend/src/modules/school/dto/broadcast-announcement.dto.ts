import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/** Données pour diffuser une annonce à un large public (ex: tous les utilisateurs de la plateforme). */
export class BroadcastAnnouncementDto {
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
}
