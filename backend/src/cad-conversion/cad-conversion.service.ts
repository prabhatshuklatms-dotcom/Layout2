import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

@Injectable()
export class CadConversionService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.cadConversion.create({ data });
  }

  async findAll(projectId?: number) {
    return this.prisma.cadConversion.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number) {
    const conversion = await this.prisma.cadConversion.findUnique({ where: { id } });
    if (!conversion) throw new NotFoundException('Conversion not found');
    return conversion;
  }

  async update(id: number, data: any) {
    return this.prisma.cadConversion.update({
      where: { id },
      data
    });
  }

  async remove(id: number) {
    return this.prisma.cadConversion.delete({ where: { id } });
  }

  // ── Composite SVG ──────────────────────────────────────────────────────────
  // Builds an SVG that contains the base drawing PLUS all runtime overlays
  // (plot status colors, plot number labels, amenity icons) so the map
  // renders exactly what the editor shows.
  async getCompositeSvg(id: number): Promise<string> {
    const conversion = await this.prisma.cadConversion.findUnique({ where: { id } });
    if (!conversion) throw new NotFoundException('Conversion not found');
    if (!conversion.svgFilePath || !fs.existsSync(conversion.svgFilePath)) {
      throw new NotFoundException('SVG file not available');
    }

    // 1. Read the base SVG
    const baseSvg = fs.readFileSync(conversion.svgFilePath, 'utf-8');
    const dom = new JSDOM(baseSvg, { contentType: 'image/svg+xml' });
    const doc = dom.window.document;
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return baseSvg;

    // 2. Query all related data
    const projectId = conversion.projectId;
    if (!projectId) return baseSvg; // No project, can't overlay anything

    const [plots, statuses, placements] = await Promise.all([
      this.prisma.projectPlot.findMany({ where: { projectId } }),
      this.prisma.plotStatus.findMany({ where: { projectId } }),
      this.prisma.amenityPlacement.findMany({
        where: { conversionId: id },
        include: { amenity: true },
      }),
    ]);

    // 3. Apply plot status fill colors to elements with data-plot-id
    const plotElements = svgEl.querySelectorAll('[data-plot-id]');
    plotElements.forEach((el: any) => {
      const plotId = parseInt(el.getAttribute('data-plot-id'));
      const plot = plots.find(p => p.id === plotId);
      if (plot && plot.statusId) {
        const status = statuses.find(s => s.id === plot.statusId);
        if (status && status.fillColor) {
          el.setAttribute('fill', status.fillColor);
          el.style.fill = status.fillColor;
        }
      }
    });

    // 4. Generate plot label text elements
    if (plots.length > 0) {
      const labelsGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelsGroup.setAttribute('id', 'composite-plot-labels');

      plotElements.forEach((el: any) => {
        const plotId = parseInt(el.getAttribute('data-plot-id'));
        const plot = plots.find(p => p.id === plotId);
        if (!plot) return;

        // Compute centroid from bounding box (server-side approximation)
        const labelDx = parseFloat(el.getAttribute('data-label-dx') || '0');
        const labelDy = parseFloat(el.getAttribute('data-label-dy') || '0');
        const fontSize = parseFloat(el.getAttribute('data-label-fontsize') || '14');
        const fontFamily = el.getAttribute('data-label-fontfamily') || 'sans-serif';
        const color = el.getAttribute('data-label-color') || '#ffffff';
        const showArea = el.getAttribute('data-label-show-area') !== 'false';
        const rotation = parseFloat(el.getAttribute('data-label-rotation') || '0');
        const align = el.getAttribute('data-label-align') || 'middle';

        // Approximate centroid from element geometry
        const centroid = this.approximateCentroid(el);
        if (!centroid) return;

        const cx = centroid.x + labelDx;
        const cy = centroid.y + labelDy;

        // Build label lines
        const lines: { text: string; size: number; weight: string }[] = [];
        lines.push({ text: plot.plotNumber || '?', size: fontSize * 1.5, weight: 'bold' });
        if (showArea) {
          if (plot.areaSqMeter) lines.push({ text: `${plot.areaSqMeter} m²`, size: fontSize * 0.9, weight: 'normal' });
          if (plot.areaSqYard) lines.push({ text: `${plot.areaSqYard} yd²`, size: fontSize * 0.9, weight: 'normal' });
        }

        // Calculate vertical positions
        let currentY = 0;
        const lineData = lines.map(l => {
          const y = currentY;
          currentY += l.size * 1.3;
          return { ...l, y };
        });
        const totalHeight = currentY;
        // Center vertically
        lineData.forEach(l => {
          l.y -= (totalHeight / 2) - (l.size * 0.4);
        });

        const labelGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.setAttribute('transform', `translate(${cx}, ${cy}) rotate(${rotation})`);

        for (const l of lineData) {
          const textEl = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
          textEl.setAttribute('x', '0');
          textEl.setAttribute('y', String(l.y));
          textEl.setAttribute('text-anchor', align);
          textEl.setAttribute('fill', color);
          textEl.setAttribute('font-size', String(l.size));
          textEl.setAttribute('font-weight', l.weight);
          textEl.setAttribute('font-family', fontFamily);
          textEl.textContent = l.text;
          labelGroup.appendChild(textEl);
        }

        labelsGroup.appendChild(labelGroup);
      });

      svgEl.appendChild(labelsGroup);
    }

    // 5. Embed amenity images
    if (placements.length > 0) {
      const amenitiesGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      amenitiesGroup.setAttribute('id', 'composite-amenities');

      for (const placement of placements) {
        const amenity = (placement as any).amenity;
        if (!amenity || !amenity.iconPath) continue;

        // Read amenity icon and base64-encode for self-contained SVG
        const iconRelPath = amenity.iconPath.replace(/^\/api\/amenities\//, '');
        const iconAbsPath = `./uploads/amenities/${iconRelPath.replace('uploads/', '')}`;
        
        let href = `http://localhost:5000${amenity.iconPath}`;
        // Try to embed as base64 for self-contained SVG
        try {
          const rawPath = amenity.iconPath.replace('/api/amenities/uploads/', '');
          const filePath = `./uploads/amenities/${rawPath}`;
          if (fs.existsSync(filePath)) {
            const imageBuffer = fs.readFileSync(filePath);
            const ext = rawPath.split('.').pop()?.toLowerCase() || 'png';
            const mimeMap: Record<string, string> = { 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'svg': 'image/svg+xml', 'gif': 'image/gif', 'webp': 'image/webp' };
            const mime = mimeMap[ext] || 'image/png';
            href = `data:${mime};base64,${imageBuffer.toString('base64')}`;
          }
        } catch (e) {
          // Fall back to URL if base64 fails
        }

        const w = placement.width || amenity.defaultWidth || 20;
        const h = placement.height || amenity.defaultHeight || 20;
        const rot = placement.rotation || 0;

        const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${placement.x}, ${placement.y}) rotate(${rot})`);

        const img = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', href);
        img.setAttribute('x', String(-w / 2));
        img.setAttribute('y', String(-h / 2));
        img.setAttribute('width', String(w));
        img.setAttribute('height', String(h));
        img.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        g.appendChild(img);
        amenitiesGroup.appendChild(g);
      }

      svgEl.appendChild(amenitiesGroup);
    }

    return svgEl.outerHTML;
  }

  // Approximate centroid from SVG element attributes (server-side, no getBBox)
  private approximateCentroid(el: any): { x: number; y: number } | null {
    const tag = el.tagName?.toLowerCase();
    try {
      if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const w = parseFloat(el.getAttribute('width') || '0');
        const h = parseFloat(el.getAttribute('height') || '0');
        return { x: x + w / 2, y: y + h / 2 };
      }
      if (tag === 'circle') {
        return {
          x: parseFloat(el.getAttribute('cx') || '0'),
          y: parseFloat(el.getAttribute('cy') || '0'),
        };
      }
      if (tag === 'ellipse') {
        return {
          x: parseFloat(el.getAttribute('cx') || '0'),
          y: parseFloat(el.getAttribute('cy') || '0'),
        };
      }
      if (tag === 'polygon' || tag === 'polyline') {
        const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
        if (pts.length < 4) return null;
        let sumX = 0, sumY = 0, count = 0;
        for (let i = 0; i + 1 < pts.length; i += 2) {
          sumX += parseFloat(pts[i]);
          sumY += parseFloat(pts[i + 1]);
          count++;
        }
        return count > 0 ? { x: sumX / count, y: sumY / count } : null;
      }
      if (tag === 'path') {
        // For paths, parse M/L/C coordinates for a rough centroid
        const d = el.getAttribute('d') || '';
        const nums = d.match(/[-+]?\d*\.?\d+/g);
        if (!nums || nums.length < 2) return null;
        let sumX = 0, sumY = 0, count = 0;
        for (let i = 0; i + 1 < nums.length; i += 2) {
          sumX += parseFloat(nums[i]);
          sumY += parseFloat(nums[i + 1]);
          count++;
        }
        return count > 0 ? { x: sumX / count, y: sumY / count } : null;
      }
    } catch (e) {}
    return null;
  }
}

