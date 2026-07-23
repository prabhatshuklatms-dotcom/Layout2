import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';

@Injectable()
export class AmenityService {
  constructor(private prisma: PrismaService) {}

  create(createAmenityDto: any) {
    return this.prisma.amenity.create({ data: createAmenityDto });
  }

  findAll() {
    return this.prisma.amenity.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: number) {
    const amenity = await this.prisma.amenity.findUnique({ where: { id } });
    if (!amenity) throw new NotFoundException('Amenity not found');
    return amenity;
  }

  update(id: number, updateAmenityDto: any) {
    return this.prisma.amenity.update({
      where: { id },
      data: updateAmenityDto,
    });
  }

  remove(id: number) {
    return this.prisma.amenity.delete({ where: { id } });
  }
}
