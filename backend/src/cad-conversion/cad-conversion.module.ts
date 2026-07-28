import { Module } from '@nestjs/common';
import { CadConversionController } from './cad-conversion.controller';
import { CadConversionService } from './cad-conversion.service';
import { ConversionPipelineService } from './conversion-pipeline.service';
import { CadConfigService } from './cad-config.service';
import { PlotDetectionService } from './plot-detection.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CadConversionController],
  providers: [CadConversionService, ConversionPipelineService, CadConfigService, PlotDetectionService],
})
export class CadConversionModule {}
