import { Module } from '@nestjs/common';
import { AmenityPlacementService } from './amenity-placement.service';
import { AmenityPlacementController } from './amenity-placement.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AmenityPlacementController],
  providers: [AmenityPlacementService],
})
export class AmenityPlacementModule {}
