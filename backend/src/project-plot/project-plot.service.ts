import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectPlotService {
  constructor(private prisma: PrismaService) {}

  create(createProjectPlotDto: any) {
    return this.prisma.projectPlot.create({
      data: createProjectPlotDto,
      include: { status: true },
    });
  }

  findAllByProject(projectId: number) {
    return this.prisma.projectPlot.findMany({
      where: { projectId },
      include: { status: true },
      orderBy: { plotNumber: 'asc' },
    });
  }

  async findOne(id: number) {
    const plot = await this.prisma.projectPlot.findUnique({
      where: { id },
      include: { status: true },
    });
    if (!plot) throw new NotFoundException('Plot not found');
    return plot;
  }

  update(id: number, updateProjectPlotDto: any) {
    return this.prisma.projectPlot.update({
      where: { id },
      data: updateProjectPlotDto,
      include: { status: true },
    });
  }

  remove(id: number) {
    return this.prisma.projectPlot.delete({ where: { id } });
  }
}
