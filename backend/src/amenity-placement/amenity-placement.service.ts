import { Injectable } from '@nestjs/common';
import { CreateAmenityPlacementDto } from './dto/create-amenity-placement.dto';
import { UpdateAmenityPlacementDto } from './dto/update-amenity-placement.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AmenityPlacementService {
  constructor(private prisma: PrismaService) {}

  create(createAmenityPlacementDto: CreateAmenityPlacementDto) {
    return this.prisma.amenityPlacement.create({
      data: createAmenityPlacementDto,
    });
  }

  findAll(conversionId?: number) {
    return this.prisma.amenityPlacement.findMany({
      where: conversionId ? { conversionId } : undefined,
      include: { amenity: true },
    });
  }

  findOne(id: number) {
    return this.prisma.amenityPlacement.findUnique({
      where: { id },
      include: { amenity: true },
    });
  }

  update(id: number, updateAmenityPlacementDto: UpdateAmenityPlacementDto) {
    return this.prisma.amenityPlacement.update({
      where: { id },
      data: updateAmenityPlacementDto,
    });
  }

  remove(id: number) {
    return this.prisma.amenityPlacement.delete({
      where: { id },
    });
  }
}
