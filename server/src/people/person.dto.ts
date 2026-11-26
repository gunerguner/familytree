import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PARENT_ROLES, ParentRole } from './parent-link.entity';

export class ParentInput {
  @IsInt()
  personId!: number;

  @IsIn(PARENT_ROLES)
  role!: ParentRole;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class MarriageInput {
  @IsInt()
  personId!: number;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

export class PersonInput {
  @IsString()
  name!: string;

  @IsIn(SEXES)
  sex!: Sex;

  @IsOptional()
  @IsString()
  kinship?: string | null;

  @IsOptional()
  @IsString()
  formerName?: string | null;

  @IsOptional()
  @IsString()
  nickname?: string | null;

  @IsOptional()
  @IsString()
  birthText?: string | null;

  @IsOptional()
  @IsString()
  deathText?: string | null;

  @IsOptional()
  @IsString()
  narrative?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParentInput)
  parents!: ParentInput[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarriageInput)
  marriages!: MarriageInput[];
}
