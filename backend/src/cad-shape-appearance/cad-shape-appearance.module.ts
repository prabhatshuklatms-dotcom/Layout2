import { Module } from '@nestjs/common';
import { CadShapeAppearanceService } from './cad-shape-appearance.service';
import { CadShapeAppearanceController } from './cad-shape-appearance.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CadShapeAppearanceController],
  providers: [CadShapeAppearanceService],
  exports: [CadShapeAppearanceService]
})
export class CadShapeAppearanceModule {}
