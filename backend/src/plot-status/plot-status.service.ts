import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlotStatusService {
  constructor(private prisma: PrismaService) {}

  create(createPlotStatusDto: any) {
    return this.prisma.plotStatus.create({ data: createPlotStatusDto });
  }

  async findOne(id: number) {
    const status = await this.prisma.plotStatus.findUnique({ where: { id } });
    if (!status) throw new NotFoundException('Plot status not found');
    return status;
  }

  update(id: number, updatePlotStatusDto: any) {
    return this.prisma.plotStatus.update({
      where: { id },
      data: updatePlotStatusDto,
    });
  }

  async remove(id: number) {
    const plotsWithStatus = await this.prisma.projectPlot.count({
      where: { statusId: id }
    });
    
    if (plotsWithStatus > 0) {
      throw new BadRequestException(`Cannot delete Plot Status. It is currently assigned to ${plotsWithStatus} plot(s).`);
    }

    return this.prisma.plotStatus.delete({ where: { id } });
  }

  // --- Project Specific Methods ---

  async findProjectStatusesPaginated(projectId: number, params: { page?: number, limit?: number, search?: string, pagination?: boolean }) {
    const { page = 1, limit = 10, search, pagination = true } = params;
    
    const where: any = { projectId };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (pagination === false) {
      const [total, data] = await Promise.all([
        this.prisma.plotStatus.count({ where }),
        this.prisma.plotStatus.findMany({
          where,
          orderBy: { id: 'asc' },
        })
      ]);
      return { data, total };
    }

    const [total, data] = await Promise.all([
      this.prisma.plotStatus.count({ where }),
      this.prisma.plotStatus.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      })
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

  async createProjectStatus(projectId: number, data: any) {
    // Check for duplicate name in same project
    const existing = await this.prisma.plotStatus.findFirst({
      where: { projectId, name: data.name }
    });
    if (existing) {
      throw new BadRequestException(`Status with name '${data.name}' already exists in this project.`);
    }

    return this.prisma.plotStatus.create({
      data: { ...data, projectId },
    });
  }
}
