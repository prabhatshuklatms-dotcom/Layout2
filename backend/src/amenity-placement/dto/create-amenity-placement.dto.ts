import { IsNumber, IsOptional } from 'class-validator';

export class CreateAmenityPlacementDto {
  @IsNumber()
  amenityId: number;

  @IsNumber()
  projectId: number;

  @IsNumber()
  conversionId: number;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsOptional()
  @IsNumber()
  layerOrder?: number;
}
