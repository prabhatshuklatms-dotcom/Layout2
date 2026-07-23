import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException, Req, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AmenityService } from './amenity.service';
import { diskStorage, memoryStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

@Controller('api/amenities')
export class AmenityController {
  constructor(private readonly amenityService: AmenityService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('icon', { storage: memoryStorage() }))
  async uploadIcon(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Icon file is required');
    
    const uploadDir = './uploads/amenities';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const isSvg = file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg');

    if (isSvg) {
      let svgContent = file.buffer.toString('utf-8');
      
      if (!svgContent.includes('<svg')) {
        throw new BadRequestException('Invalid SVG file format');
      }

      // Initialize DOMPurify with JSDOM
      const window = new JSDOM('').window;
      const purify = DOMPurify(window);
      
      const cleanSvg = purify.sanitize(svgContent, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });

      if (!cleanSvg.includes('<svg')) {
        throw new BadRequestException('SVG content was rejected due to malicious or invalid syntax');
      }

      const uniqueSuffix = uuidv4() + '.svg';
      const filePath = path.join(uploadDir, uniqueSuffix);
      fs.writeFileSync(filePath, cleanSvg, 'utf-8');
      return { iconPath: `/api/amenities/uploads/${uniqueSuffix}` };
    } else {
      // Handle raster images (PNG, JPG, WEBP)
      const isWebp = file.mimetype === 'image/webp' || file.originalname.toLowerCase().endsWith('.webp');
      const ext = isWebp ? '.webp' : '.png';
      
      const uniqueSuffix = uuidv4() + ext;
      const filePath = path.join(uploadDir, uniqueSuffix);

      const img = sharp(file.buffer).resize(128, 128, { fit: 'inside' }).ensureAlpha();
      
      if (isWebp) {
        await img.webp({ quality: 100 }).toFile(filePath);
      } else {
        await img.png({ quality: 100 }).toFile(filePath);
      }

      return { iconPath: `/api/amenities/uploads/${uniqueSuffix}` };
    }
  }

  @Get('uploads/:filename')
  serveIcon(@Param('filename') filename: string, @Req() req: any, @Res() res: any) {
    const filePath = path.resolve('./uploads/amenities', filename);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Icon not found');
    }
    return res.sendFile(filePath);
  }

  @Post()
  create(@Body() createAmenityDto: any) {
    return this.amenityService.create(createAmenityDto);
  }

  @Get()
  findAll() {
    return this.amenityService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.amenityService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAmenityDto: any) {
    return this.amenityService.update(+id, updateAmenityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.amenityService.remove(+id);
  }
}
