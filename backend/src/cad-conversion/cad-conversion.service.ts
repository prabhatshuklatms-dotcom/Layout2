import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CadConversionService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.cadConversion.create({ data });
  }

  async findAll(projectId?: number) {
    return this.prisma.cadConversion.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number) {
    const conversion = await this.prisma.cadConversion.findUnique({ where: { id } });
    if (!conversion) throw new NotFoundException('Conversion not found');
    return conversion;
  }

  async update(id: number, data: any) {
    return this.prisma.cadConversion.update({
      where: { id },
      data
    });
  }

  async remove(id: number) {
    return this.prisma.cadConversion.delete({ where: { id } });
  }
}
