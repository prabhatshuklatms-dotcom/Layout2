import { PartialType } from '@nestjs/mapped-types';
import { CreateAmenityPlacementDto } from './create-amenity-placement.dto';

export class UpdateAmenityPlacementDto extends PartialType(CreateAmenityPlacementDto) {}
