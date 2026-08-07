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

  async findAllPaginated(params: { page?: number, limit?: number, search?: string, pagination?: boolean }) {
    const { page = 1, limit = 10, search, pagination = true } = params;
    
    const where = search ? {
      name: {
        contains: search,
        mode: 'insensitive' as const
      }
    } : {};

    if (pagination === false) {
      const [data, total] = await Promise.all([
        this.prisma.amenity.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.amenity.count({ where })
      ]);
      return { data, total };
    }

    const [data, total] = await Promise.all([
      this.prisma.amenity.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.amenity.count({ where })
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
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
