import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AmenityPlacementService } from './amenity-placement.service';
import { CreateAmenityPlacementDto } from './dto/create-amenity-placement.dto';
import { UpdateAmenityPlacementDto } from './dto/update-amenity-placement.dto';

@Controller('api/amenity-placement')
export class AmenityPlacementController {
  constructor(private readonly amenityPlacementService: AmenityPlacementService) {}

  @Post()
  create(@Body() createAmenityPlacementDto: CreateAmenityPlacementDto) {
    return this.amenityPlacementService.create(createAmenityPlacementDto);
  }

  @Get()
  findAll(@Query('conversionId') conversionId?: string) {
    return this.amenityPlacementService.findAll(conversionId ? +conversionId : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.amenityPlacementService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAmenityPlacementDto: UpdateAmenityPlacementDto) {
    return this.amenityPlacementService.update(+id, updateAmenityPlacementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.amenityPlacementService.remove(+id);
  }
}
