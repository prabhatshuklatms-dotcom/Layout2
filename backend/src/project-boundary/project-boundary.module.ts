import { Module } from '@nestjs/common';
import { ProjectBoundaryService } from './project-boundary.service';
import { ProjectBoundaryController } from './project-boundary.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ProjectBoundaryController],
  providers: [ProjectBoundaryService, PrismaService],
})
export class ProjectBoundaryModule {}
