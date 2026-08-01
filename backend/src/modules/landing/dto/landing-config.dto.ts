import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const STAT_ICONS = [
  'ShieldCheck',
  'BadgeCheck',
  'Sparkles',
  'Building2',
  'UserRound',
  'ClipboardCheck',
] as const;

export const ACTOR_ICONS = [
  'GraduationCap',
  'Building2',
  'Landmark',
  'ShieldCheck',
] as const;

export class HeroConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subtitle: string;
}

export class StatItemDto {
  @IsIn(STAT_ICONS)
  icon: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  value: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label: string;
}

export class StatsConfigDto {
  @ValidateNested({ each: true })
  @Type(() => StatItemDto)
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  items: StatItemDto[];
}

export class StepItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  text: string;
}

export class StepsConfigDto {
  @ValidateNested({ each: true })
  @Type(() => StepItemDto)
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  items: StepItemDto[];
}

export class ActorCardItemDto {
  @IsIn(ACTOR_ICONS)
  icon: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  text: string;
}

export class ActorCardsConfigDto {
  @ValidateNested({ each: true })
  @Type(() => ActorCardItemDto)
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  items: ActorCardItemDto[];
}
