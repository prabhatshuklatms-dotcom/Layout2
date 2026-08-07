import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, BadRequestException, Query } from '@nestjs/common';
import { ProjectPlotService } from './project-plot.service';
import { CreateProjectPlotDto } from './dto/create-project-plot.dto';
import { UpdateProjectPlotDto } from './dto/update-project-plot.dto';

@Controller('api/projects/:projectId/plots')
export class ProjectPlotController {
  private readonly logger = new Logger(ProjectPlotController.name);

  constructor(private readonly projectPlotService: ProjectPlotService) {}

  @Post('bulk')
  async createBulk(@Param('projectId') projectId: string, @Body() createProjectPlotsDto: CreateProjectPlotDto[]) {
    this.logger.log(`[Bulk Create] Received payload for projectId: ${projectId} with ${createProjectPlotsDto?.length || 0} plots`);
    
    if (!Array.isArray(createProjectPlotsDto) || createProjectPlotsDto.length === 0) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid payload',
        reason: 'Payload must be a non-empty array of plots'
      });
    }

    return this.projectPlotService.createBulk(+projectId, createProjectPlotsDto);
  }

  @Post()
  create(@Param('projectId') projectId: string, @Body() createProjectPlotDto: CreateProjectPlotDto) {
    return this.projectPlotService.create(+projectId, createProjectPlotDto);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('pagination') pagination?: string
  ) {
    return this.projectPlotService.findAllByProject(+projectId, page, limit, search, pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectPlotService.findOne(+id);
  }

  @Patch(':id/assignment')
  updateAssignment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { 
      cadRegionId: string | null;
      conversionId?: number | null;
      cadObjectType?: string | null;
      x?: number | null;
      y?: number | null;
      rotation?: number | null;
      scale?: number | null;
      metadata?: any | null;
    }
  ) {
    if (body.cadRegionId !== null && typeof body.cadRegionId !== 'string') {
      throw new BadRequestException('cadRegionId must be a string or null');
    }
    return this.projectPlotService.updateAssignment(+id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectPlotDto: UpdateProjectPlotDto) {
    return this.projectPlotService.update(+id, updateProjectPlotDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectPlotService.remove(+id);
  }
}
