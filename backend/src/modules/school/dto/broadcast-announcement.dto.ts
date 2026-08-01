import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class BroadcastAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
