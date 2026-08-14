import { Controller, Get, Post, Put, Param, Delete, Patch, Body, UseInterceptors, UploadedFile, BadRequestException, Res, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CadConversionService } from './cad-conversion.service';
import { ConversionPipelineService } from './conversion-pipeline.service';
import { diskStorage } from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import * as fs from 'fs';

@Controller('api/cad-conversion')
export class CadConversionController {
  constructor(
    private readonly cadConversionService: CadConversionService,
    private readonly conversionPipeline: ConversionPipelineService
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/cad',
      filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueSuffix);
      }
    }),
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.dxf' && ext !== '.dwg') {
        return cb(new BadRequestException('Only .dxf and .dwg files are allowed'), false);
      }
      cb(null, true);
    }
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('projectId') projectId?: string) {
    if (!file) throw new BadRequestException('File is required');
    
    // Ensure uploads/cad directory exists
    if (!fs.existsSync('./uploads/cad')) {
      fs.mkdirSync('./uploads/cad', { recursive: true });
    }
    
    // Create DB record
    const conversion = await this.cadConversionService.create({
      originalFileName: file.originalname,
      originalFilePath: file.path,
      fileSize: file.size,
      status: 'PENDING',
      projectId: projectId ? +projectId : undefined
    });

    // Start pipeline asynchronously (so request can return immediately)
    this.conversionPipeline.runPipeline(conversion.id, file.path, file.originalname).catch(console.error);

    return conversion;
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/cad',
      filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueSuffix);
      }
    }),
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.dxf' && ext !== '.dwg') {
        return cb(new BadRequestException('Only .dxf and .dwg files are allowed'), false);
      }
      cb(null, true);
    }
  }))
  async updateFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    
    if (!fs.existsSync('./uploads/cad')) {
      fs.mkdirSync('./uploads/cad', { recursive: true });
    }
    
    const conversion = await this.cadConversionService.update(+id, {
      originalFileName: file.originalname,
      originalFilePath: file.path,
      fileSize: file.size,
      status: 'PENDING',
      svgFilePath: null
    });

    this.conversionPipeline.runPipeline(conversion.id, file.path, file.originalname).catch(console.error);

    return conversion;
  }

  @Get()
  async findAll(@Query('projectId') projectId?: string) {
    return this.cadConversionService.findAll(projectId ? +projectId : undefined);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.cadConversionService.findOne(+id);
  }

  @Get(':id/composite-svg')
  async getCompositeSvg(@Param('id') id: string, @Res() res: Response) {
    const data = await this.cadConversionService.getCompositeSvg(+id);
    res.setHeader('Cache-Control', 'no-cache');
    res.json(data);
  }

  @Get(':id/svg')
  async getSvg(@Param('id') id: string, @Res() res: Response) {
    const conversion = await this.cadConversionService.findOne(+id);
    if (!conversion.svgFilePath || !fs.existsSync(conversion.svgFilePath)) {
      throw new BadRequestException('SVG file not available');
    }
    // Run migration pass so the editor always receives a plot-detected SVG,
    // even for legacy conversions that pre-date the Plot Detection Engine.
    const svgContent = await this.cadConversionService.getEditorSvg(+id);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgContent);
  }

  @Put(':id/svg')
  async updateSvg(@Param('id') id: string, @Body() body: { svg: string }) {
    const conversion = await this.cadConversionService.findOne(+id);
    if (!conversion.svgFilePath) {
      throw new BadRequestException('SVG file path not found for this conversion');
    }
    if (!body.svg) {
      throw new BadRequestException('SVG content is required');
    }
    fs.writeFileSync(conversion.svgFilePath, body.svg, 'utf-8');
    return { success: true };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.cadConversionService.update(+id, body);
  }

  @Patch(':id/activate')
  async activateLayout(@Param('id') id: string) {
    return this.cadConversionService.activateLayout(+id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.cadConversionService.remove(+id);
  }
}
