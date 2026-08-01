import { IsString, IsOptional, IsNumber, IsEnum, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PlotType } from '@prisma/client';

export class DimensionDto {
  @IsString()
  label: string;

  @IsNumber()
  @Min(0.0001, { message: 'Dimension value must be greater than 0' })
  value: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateProjectPlotDto {
  @IsString()
  plotNumber: string;

  @IsEnum(PlotType)
  @IsOptional()
  plotType?: PlotType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DimensionDto)
  dimensions?: DimensionDto[];

  @IsOptional()
  @IsNumber()
  areaSqFt?: number;

  @IsOptional()
  @IsNumber()
  areaSqYard?: number;

  @IsOptional()
  @IsNumber()
  areaSqMeter?: number;

  @IsOptional()
  @IsNumber()
  statusId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
