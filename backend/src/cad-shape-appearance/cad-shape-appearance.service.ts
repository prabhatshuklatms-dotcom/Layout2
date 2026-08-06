import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ShapeAppearanceUpdate {
  cadRegionId: string;
  fillColor?: string | null;
  strokeColor?: string | null;
}

@Injectable()
export class CadShapeAppearanceService {
  private readonly logger = new Logger(CadShapeAppearanceService.name);

  constructor(private prisma: PrismaService) {}

  async findAllByConversion(conversionId: number) {
    return this.prisma.cadShapeAppearance.findMany({
      where: { conversionId }
    });
  }

  async updateBulk(conversionId: number, updates: ShapeAppearanceUpdate[]) {
    this.logger.log(`[updateBulk] Updating appearance for ${updates.length} shapes in conversion ${conversionId}`);
    try {
      const results = await this.prisma.$transaction(
        updates.map((update) =>
          this.prisma.cadShapeAppearance.upsert({
            where: {
              conversionId_cadRegionId: {
                conversionId,
                cadRegionId: update.cadRegionId
              }
            },
            update: {
              fillColor: update.fillColor,
              strokeColor: update.strokeColor
            },
            create: {
              conversionId,
              cadRegionId: update.cadRegionId,
              fillColor: update.fillColor,
              strokeColor: update.strokeColor
            }
          })
        )
      );
      return { success: true, count: results.length };
    } catch (error) {
      this.logger.error(`[updateBulk] Error: ${error.message}`, error.stack);
      throw new BadRequestException({
        success: false,
        message: 'Failed to update bulk shape appearances',
        reason: error.message
      });
    }
  }
}
