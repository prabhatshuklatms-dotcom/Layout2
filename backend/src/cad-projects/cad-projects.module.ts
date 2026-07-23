import { Module } from '@nestjs/common';
import { CadProjectsService } from './cad-projects.service';
import { CadProjectsController } from './cad-projects.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CadProjectsController],
  providers: [CadProjectsService],
  exports: [CadProjectsService],
})
export class CadProjectsModule {}
