import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { PlotStatusService } from './plot-status.service';

@Controller('api/plot-statuses')
export class PlotStatusController {
  constructor(private readonly plotStatusService: PlotStatusService) {}

  @Post()
  create(@Body() createPlotStatusDto: any) {
    return this.plotStatusService.create(createPlotStatusDto);
  }

  // --- Project Specific Routes ---

  @Get('project/:projectId')
  findProjectStatuses(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('pagination') pagination?: string
  ) {
    return this.plotStatusService.findProjectStatusesPaginated(projectId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      pagination: pagination === 'false' ? false : true
    });
  }

  @Post('project/:projectId')
  createProjectStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() createPlotStatusDto: any
  ) {
    return this.plotStatusService.createProjectStatus(projectId, createPlotStatusDto);
  }

  @Patch('project/:projectId/:id')
  updateProjectStatus(
    @Param('projectId', ParseIntPipe) projectId: number, // not directly needed for update, but good for route structure
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePlotStatusDto: any
  ) {
    return this.plotStatusService.update(id, updatePlotStatusDto);
  }

  @Delete('project/:projectId/:id')
  deleteProjectStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.plotStatusService.remove(id);
  }

  // --- Generic Routes ---

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plotStatusService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updatePlotStatusDto: any) {
    return this.plotStatusService.update(id, updatePlotStatusDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.plotStatusService.remove(id);
  }
}
