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

  async findProjectStatuses(projectId: number) {
    return this.prisma.plotStatus.findMany({
      where: { projectId },
      orderBy: { displayOrder: 'asc' },
    });
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
