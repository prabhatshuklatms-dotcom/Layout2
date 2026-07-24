import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectBoundaryService {
  constructor(private prisma: PrismaService) {}

  async findAllByProject(projectId: number) {
    return this.prisma.projectBoundary.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(projectId: number, data: any) {
    // Basic validation / mapping
    return this.prisma.projectBoundary.create({
      data: {
        projectId,
        name: data.name || 'Boundary',
        area: data.area,
        pointCount: data.pointCount,
        latMin: data.latMin,
        latMax: data.latMax,
        lngMin: data.lngMin,
        lngMax: data.lngMax,
        geoJson: data.geoJson,
      },
    });
  }

  async update(id: number, data: any) {
    const boundary = await this.prisma.projectBoundary.findUnique({ where: { id } });
    if (!boundary) throw new NotFoundException(`Boundary with ID ${id} not found`);

    return this.prisma.projectBoundary.update({
      where: { id },
      data: {
        name: data.name,
        area: data.area,
        pointCount: data.pointCount,
        latMin: data.latMin,
        latMax: data.latMax,
        lngMin: data.lngMin,
        lngMax: data.lngMax,
        geoJson: data.geoJson,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.projectBoundary.delete({
      where: { id },
    });
  }
}
