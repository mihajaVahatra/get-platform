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

export class HeroContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subtitle: string;
}

export class HeroConfigDto {
  @ValidateNested()
  @Type(() => HeroContentDto)
  fr: HeroContentDto;

  @ValidateNested()
  @Type(() => HeroContentDto)
  en: HeroContentDto;
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

export class StatsContentDto {
  @ValidateNested({ each: true })
  @Type(() => StatItemDto)
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  items: StatItemDto[];
}

export class StatsConfigDto {
  @ValidateNested()
  @Type(() => StatsContentDto)
  fr: StatsContentDto;

  @ValidateNested()
  @Type(() => StatsContentDto)
  en: StatsContentDto;
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

export class StepsContentDto {
  @ValidateNested({ each: true })
  @Type(() => StepItemDto)
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  items: StepItemDto[];
}

export class StepsConfigDto {
  @ValidateNested()
  @Type(() => StepsContentDto)
  fr: StepsContentDto;

  @ValidateNested()
  @Type(() => StepsContentDto)
  en: StepsContentDto;
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

export class ActorCardsContentDto {
  @ValidateNested({ each: true })
  @Type(() => ActorCardItemDto)
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  items: ActorCardItemDto[];
}

export class ActorCardsConfigDto {
  @ValidateNested()
  @Type(() => ActorCardsContentDto)
  fr: ActorCardsContentDto;

  @ValidateNested()
  @Type(() => ActorCardsContentDto)
  en: ActorCardsContentDto;
}
