import { Module } from '@nestjs/common';
import { PlotStatusService } from './plot-status.service';
import { PlotStatusController } from './plot-status.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PlotStatusController],
  providers: [PlotStatusService],
})
export class PlotStatusModule {}
