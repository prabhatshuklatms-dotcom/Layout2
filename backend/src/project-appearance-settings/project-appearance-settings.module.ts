import { Module } from '@nestjs/common';
import { ProjectAppearanceSettingsService } from './project-appearance-settings.service';
import { ProjectAppearanceSettingsController } from './project-appearance-settings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectAppearanceSettingsController],
  providers: [ProjectAppearanceSettingsService],
})
export class ProjectAppearanceSettingsModule {}
