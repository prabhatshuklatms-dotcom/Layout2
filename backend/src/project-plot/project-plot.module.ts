import { Module } from '@nestjs/common';
import { ProjectPlotService } from './project-plot.service';
import { ProjectPlotController } from './project-plot.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectPlotController],
  providers: [ProjectPlotService],
})
export class ProjectPlotModule {}
