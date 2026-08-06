import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { CadShapeAppearanceService, ShapeAppearanceUpdate } from './cad-shape-appearance.service';

@Controller('api/cad-conversion/:conversionId/shapes/appearance')
export class CadShapeAppearanceController {
  constructor(private readonly cadShapeAppearanceService: CadShapeAppearanceService) {}

  @Get()
  findAll(@Param('conversionId') conversionId: string) {
    return this.cadShapeAppearanceService.findAllByConversion(+conversionId);
  }

  @Patch('bulk')
  updateBulk(
    @Param('conversionId') conversionId: string,
    @Body() body: { updates: ShapeAppearanceUpdate[] }
  ) {
    return this.cadShapeAppearanceService.updateBulk(+conversionId, body.updates);
  }
}
