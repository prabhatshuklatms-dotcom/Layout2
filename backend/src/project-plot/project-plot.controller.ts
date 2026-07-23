import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProjectPlotService } from './project-plot.service';

@Controller('api/projects/:projectId/plots')
export class ProjectPlotController {
  constructor(private readonly projectPlotService: ProjectPlotService) {}

  @Post()
  create(@Param('projectId') projectId: string, @Body() createProjectPlotDto: any) {
    return this.projectPlotService.create({
      ...createProjectPlotDto,
      projectId: +projectId,
    });
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.projectPlotService.findAllByProject(+projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectPlotService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectPlotDto: any) {
    return this.projectPlotService.update(+id, updateProjectPlotDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectPlotService.remove(+id);
  }
}
