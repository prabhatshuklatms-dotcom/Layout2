import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CadConversionModule } from './cad-conversion/cad-conversion.module';
import { CadProjectsModule } from './cad-projects/cad-projects.module';

import { PlotStatusModule } from './plot-status/plot-status.module';
import { ProjectPlotModule } from './project-plot/project-plot.module';
import { AmenityModule } from './amenity/amenity.module';
import { AmenityPlacementModule } from './amenity-placement/amenity-placement.module';
import { ProjectBoundaryModule } from './project-boundary/project-boundary.module';
import { ProjectAppearanceSettingsModule } from './project-appearance-settings/project-appearance-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CadConversionModule,
    CadProjectsModule,
    PlotStatusModule,
    ProjectPlotModule,
    AmenityModule,
    AmenityPlacementModule,
    ProjectBoundaryModule,
    ProjectAppearanceSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
