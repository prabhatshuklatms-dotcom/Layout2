import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CadProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string }) {
    return this.prisma.cadProject.create({
      data: { 
        name: data.name,
        plotStatuses: {
          create: [
            { name: 'Available', fillColor: '#22c55e', displayOrder: 1 },
            { name: 'Sold', fillColor: '#ef4444', displayOrder: 2 },
            { name: 'Reserved', fillColor: '#f97316', displayOrder: 3 },
            { name: 'Booked', fillColor: '#3b82f6', displayOrder: 4 },
            { name: 'Hold', fillColor: '#6b7280', displayOrder: 5 },
          ]
        }
      }
    });
  }

  async findAll() {
    return this.prisma.cadProject.findMany({
      include: {
        _count: {
          select: { conversions: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async findOne(id: number) {
    const project = await this.prisma.cadProject.findUnique({
      where: { id },
      include: {
        conversions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: number, data: { name?: string; latitude?: number; longitude?: number; mapZoom?: number; address?: string; city?: string; state?: string; country?: string }) {
    return this.prisma.cadProject.update({
      where: { id },
      data: { 
        ...(data.name && { name: data.name }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.mapZoom !== undefined && { mapZoom: data.mapZoom }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.country !== undefined && { country: data.country }),
      }
    });
  }

  async remove(id: number) {
    return this.prisma.cadProject.delete({
      where: { id }
    });
  }
}
