import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { ProjectAppearanceSettingsService } from './project-appearance-settings.service';

@Controller('cad-projects/:projectId/appearance-settings')
export class ProjectAppearanceSettingsController {
  constructor(private readonly projectAppearanceSettingsService: ProjectAppearanceSettingsService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() data: { dimensionColor?: string; plotColor?: string; plotLabelColor?: string }
  ) {
    return this.projectAppearanceSettingsService.create(+projectId, data);
  }

  @Get()
  findOne(@Param('projectId') projectId: string) {
    return this.projectAppearanceSettingsService.findOne(+projectId);
  }

  @Patch()
  update(
    @Param('projectId') projectId: string,
    @Body() data: { dimensionColor?: string; plotColor?: string; plotLabelColor?: string }
  ) {
    return this.projectAppearanceSettingsService.update(+projectId, data);
  }
}
