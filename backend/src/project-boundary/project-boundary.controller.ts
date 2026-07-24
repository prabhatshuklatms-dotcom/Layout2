import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProjectBoundaryService } from './project-boundary.service';

@Controller('api')
export class ProjectBoundaryController {
  constructor(private readonly projectBoundaryService: ProjectBoundaryService) {}

  @Get('projects/:id/boundaries')
  findAllByProject(@Param('id') projectId: string) {
    return this.projectBoundaryService.findAllByProject(+projectId);
  }

  @Post('projects/:id/boundaries')
  create(@Param('id') projectId: string, @Body() data: any) {
    return this.projectBoundaryService.create(+projectId, data);
  }

  @Patch('boundary/:id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.projectBoundaryService.update(+id, data);
  }

  @Delete('boundary/:id')
  remove(@Param('id') id: string) {
    return this.projectBoundaryService.remove(+id);
  }
}
