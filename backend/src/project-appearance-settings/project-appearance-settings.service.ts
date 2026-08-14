import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectAppearanceSettingsService {
  constructor(private prisma: PrismaService) {}

  async findOne(projectId: number) {
    const settings = await this.prisma.projectAppearanceSettings.findUnique({
      where: { projectId },
    });
    
    // Return null if not configured rather than throwing, 
    // as per user requirement: "If settings do not exist yet, return a clean 'not configured' response"
    return settings || null;
  }

  async create(projectId: number, data: { dimensionColor?: string; plotColor?: string; plotLabelColor?: string }) {
    const existing = await this.prisma.projectAppearanceSettings.findUnique({
      where: { projectId },
    });
    
    if (existing) {
      throw new BadRequestException(`Appearance settings already exist for project ${projectId}. Use PATCH to update.`);
    }

    return this.prisma.projectAppearanceSettings.create({
      data: {
        projectId,
        ...data,
      },
    });
  }

  async update(projectId: number, data: { dimensionColor?: string; plotColor?: string; plotLabelColor?: string }) {
    const existing = await this.prisma.projectAppearanceSettings.findUnique({
      where: { projectId },
    });
    
    if (!existing) {
      throw new NotFoundException(`Appearance settings do not exist for project ${projectId}. Use POST to create.`);
    }

    return this.prisma.projectAppearanceSettings.update({
      where: { projectId },
      data,
    });
  }
}
