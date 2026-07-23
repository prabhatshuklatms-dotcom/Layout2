import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CadProjectsService } from './cad-projects.service';

@Controller('cad-projects')
export class CadProjectsController {
  constructor(private readonly cadProjectsService: CadProjectsService) {}

  @Post()
  create(@Body() createDto: { name: string }) {
    return this.cadProjectsService.create(createDto);
  }

  @Get()
  findAll() {
    return this.cadProjectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cadProjectsService.findOne(+id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: { name?: string; latitude?: number; longitude?: number; mapZoom?: number; address?: string; city?: string; state?: string; country?: string }) {
    return this.cadProjectsService.update(+id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cadProjectsService.remove(+id);
  }
}
