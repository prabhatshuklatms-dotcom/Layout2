import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlotDetectionService } from './plot-detection.service';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

@Injectable()
export class CadConversionService {
  constructor(
    private prisma: PrismaService,
    private plotDetection: PlotDetectionService,
  ) { }

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

  /**
   * Return the SVG string for the editor, running the Plot Detection migration
   * pass first if the file was produced before the detection engine existed.
   * The normalized SVG is written back to disk so subsequent loads are instant.
   */
  async getEditorSvg(id: number): Promise<string> {
    const conversion = await this.prisma.cadConversion.findUnique({ where: { id } });
    if (!conversion) throw new NotFoundException('Conversion not found');
    if (!conversion.svgFilePath || !fs.existsSync(conversion.svgFilePath)) {
      throw new NotFoundException('SVG file not available');
    }

    let svg = fs.readFileSync(conversion.svgFilePath, 'utf-8');
    const result = this.plotDetection.detect(svg);
    if (!result.wasAlreadyNormalized) {
      svg = result.svg;
      fs.writeFileSync(conversion.svgFilePath, svg, 'utf-8');
    }
    return svg;
  }

  // ── Composite SVG ──────────────────────────────────────────────────────────
  // Builds an SVG that contains the base drawing PLUS all runtime overlays
  // (plot status colors, plot number labels, amenity icons) so the map
  // renders exactly what the editor shows.
  async getCompositeSvg(id: number): Promise<{ svg: string; interactionPolygon?: any; geometry?: any }> {
    const conversion = await this.prisma.cadConversion.findUnique({ where: { id } });
    if (!conversion) throw new NotFoundException('Conversion not found');
    if (!conversion.svgFilePath || !fs.existsSync(conversion.svgFilePath)) {
      throw new NotFoundException('SVG file not available');
    }

    // 1. Read the base SVG
    let baseSvg = fs.readFileSync(conversion.svgFilePath, 'utf-8');

    // 1a. Migration pass — if this is a legacy SVG that was converted before
    //     the Plot Detection Engine existed, run detection once and overwrite
    //     the file on disk so future loads are instant.
    const migrationResult = this.plotDetection.detect(baseSvg);
    if (!migrationResult.wasAlreadyNormalized) {
      baseSvg = migrationResult.svg;
      fs.writeFileSync(conversion.svgFilePath, baseSvg, 'utf-8');
    }

    const dom = new JSDOM(baseSvg, { contentType: 'image/svg+xml' });
    const doc = dom.window.document;
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return { svg: baseSvg, geometry: { left: 0, top: 0, width: 1, height: 1 } };

    // 2. Query all related data
    const projectId = conversion.projectId;
    if (!projectId) return { svg: svgEl.outerHTML, interactionPolygon: this.calculateInteractionPolygon(svgEl) }; // No project, can't overlay anything

    const [plots, statuses, placements] = await Promise.all([
      this.prisma.projectPlot.findMany({ where: { projectId } }),
      this.prisma.plotStatus.findMany({ where: { projectId } }),
      this.prisma.amenityPlacement.findMany({
        where: { conversionId: id },
        include: { amenity: true },
      }),
    ]);




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

    return {
      svg: svgEl.outerHTML,
      interactionPolygon: this.calculateInteractionPolygon(svgEl)
    };
  }

  /**
   * Parse the SVG viewBox, compute tight geometry bounds from visible elements,
   * then return normalized 0..1 fractions relative to the viewBox.
   * The frontend multiplies these by imgSize to get CSS pixel positions.
   */
  /**
   * Parse the SVG, extract every visible coordinate point, compute a convex hull,
   * and return the interaction polygon as normalized 0..1 fractions.
   */
  private calculateInteractionPolygon(svgEl: any): {
    vertices: [number, number][];
    centroid: [number, number];
    bounds: { left: number; top: number; width: number; height: number };
    viewBox: { width: number; height: number };
  } {
    // 1. Parse viewBox
    const vbAttr = svgEl.getAttribute('viewBox');
    let vbX = 0, vbY = 0, vbW = 1000, vbH = 1000;
    if (vbAttr) {
      const parts = vbAttr.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        [vbX, vbY, vbW, vbH] = parts;
      }
    }

    // 2. Collect ALL coordinate points from visible SVG geometry
    const points: [number, number][] = [];

    const marginX = vbW * 0.1;
    const marginY = vbH * 0.1;
    const addPoint = (x: number, y: number) => {
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return;
      // Filter out garbage geometry that lies far outside the site plan's viewBox
      if (x < vbX - marginX || x > vbX + vbW + marginX) return;
      if (y < vbY - marginY || y > vbY + vbH + marginY) return;
      points.push([x, y]);
    };

    const elements = svgEl.querySelectorAll('*');
    elements.forEach((el: any) => {
      const type = el.getAttribute('data-cad-type');
      if (type === 'background') return;
      if (el.id === 'composite-plot-labels' || el.id === 'composite-amenities') return;
      if (el.closest && (el.closest('#composite-plot-labels') || el.closest('#composite-amenities'))) return;

      const tag = el.tagName?.toLowerCase();
      try {
        if (tag === 'line') {
          addPoint(parseFloat(el.getAttribute('x1')), parseFloat(el.getAttribute('y1')));
          addPoint(parseFloat(el.getAttribute('x2')), parseFloat(el.getAttribute('y2')));
        } else if (tag === 'circle') {
          const cx = parseFloat(el.getAttribute('cx') || '0');
          const cy = parseFloat(el.getAttribute('cy') || '0');
          const r = parseFloat(el.getAttribute('r') || '0');
          // Sample 12 points around the circle
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            addPoint(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
          }
        } else if (tag === 'ellipse') {
          const cx = parseFloat(el.getAttribute('cx') || '0');
          const cy = parseFloat(el.getAttribute('cy') || '0');
          const rx = parseFloat(el.getAttribute('rx') || '0');
          const ry = parseFloat(el.getAttribute('ry') || '0');
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            addPoint(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
          }
        } else if (tag === 'rect') {
          const x = parseFloat(el.getAttribute('x') || '0');
          const y = parseFloat(el.getAttribute('y') || '0');
          const w = parseFloat(el.getAttribute('width') || '0');
          const h = parseFloat(el.getAttribute('height') || '0');
          addPoint(x, y);
          addPoint(x + w, y);
          addPoint(x + w, y + h);
          addPoint(x, y + h);
        } else if (tag === 'polygon' || tag === 'polyline') {
          const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
          for (let i = 0; i + 1 < pts.length; i += 2) {
            addPoint(parseFloat(pts[i]), parseFloat(pts[i + 1]));
          }
        } else if (tag === 'path') {
          this.samplePathPoints(el.getAttribute('d') || '', addPoint);
        }
      } catch (e) { }
    });

    // 3. Fallback if no geometry found
    if (points.length < 3) {
      return {
        vertices: [[0, 0], [1, 0], [1, 1], [0, 1]],
        centroid: [0.5, 0.5],
        bounds: { left: 0, top: 0, width: 1, height: 1 },
        viewBox: { width: vbW, height: vbH }
      };
    }

    // 4. Compute Convex Hull (Andrew's monotone chain)
    const hull = this.convexHull(points);

    // 5. Compute bounds from hull
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of hull) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    // 6. Compute polygon centroid using the signed-area formula
    const centroid = this.polygonCentroid(hull);

    // 7. Normalize everything to 0..1 fractions relative to viewBox
    const normalizedVertices: [number, number][] = hull.map(([x, y]) => [
      (x - vbX) / vbW,
      (y - vbY) / vbH
    ]);

    const normalizedCentroid: [number, number] = [
      (centroid[0] - vbX) / vbW,
      (centroid[1] - vbY) / vbH
    ];

    return {
      vertices: normalizedVertices,
      centroid: normalizedCentroid,
      bounds: {
        left:   (minX - vbX) / vbW,
        top:    (minY - vbY) / vbH,
        width:  (maxX - minX) / vbW,
        height: (maxY - minY) / vbH
      },
      viewBox: {
        width: vbW,
        height: vbH
      }
    };
  }

  /**
   * Sample coordinate points from an SVG path `d` attribute.
   * Handles M, L, H, V, C, S, Q, T, A commands (both absolute and relative).
   */
  private samplePathPoints(d: string, addPoint: (x: number, y: number) => void): void {
    // Tokenize: split into commands and their numeric arguments
    const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
    if (!tokens) return;

    let cx = 0, cy = 0; // current position
    let i = 0;

    const nextNum = (): number => {
      while (i < tokens.length && /^[A-Za-z]$/.test(tokens[i])) i++;
      return i < tokens.length ? parseFloat(tokens[i++]) : 0;
    };

    while (i < tokens.length) {
      const cmd = tokens[i];
      if (/^[A-Za-z]$/.test(cmd)) {
        i++; // consume the command letter
        switch (cmd) {
          case 'M': cx = nextNum(); cy = nextNum(); addPoint(cx, cy); break;
          case 'm': cx += nextNum(); cy += nextNum(); addPoint(cx, cy); break;
          case 'L': cx = nextNum(); cy = nextNum(); addPoint(cx, cy); break;
          case 'l': cx += nextNum(); cy += nextNum(); addPoint(cx, cy); break;
          case 'H': cx = nextNum(); addPoint(cx, cy); break;
          case 'h': cx += nextNum(); addPoint(cx, cy); break;
          case 'V': cy = nextNum(); addPoint(cx, cy); break;
          case 'v': cy += nextNum(); addPoint(cx, cy); break;
          case 'C': {
            // Cubic bezier: sample control points and endpoint
            const x1 = nextNum(), y1 = nextNum();
            const x2 = nextNum(), y2 = nextNum();
            cx = nextNum(); cy = nextNum();
            addPoint(x1, y1); addPoint(x2, y2); addPoint(cx, cy);
            break;
          }
          case 'c': {
            const x1 = cx + nextNum(), y1 = cy + nextNum();
            const x2 = cx + nextNum(), y2 = cy + nextNum();
            cx += nextNum(); cy += nextNum();
            addPoint(x1, y1); addPoint(x2, y2); addPoint(cx, cy);
            break;
          }
          case 'S': {
            const x2 = nextNum(), y2 = nextNum();
            cx = nextNum(); cy = nextNum();
            addPoint(x2, y2); addPoint(cx, cy);
            break;
          }
          case 's': {
            const x2 = cx + nextNum(), y2 = cy + nextNum();
            cx += nextNum(); cy += nextNum();
            addPoint(x2, y2); addPoint(cx, cy);
            break;
          }
          case 'Q': {
            const x1 = nextNum(), y1 = nextNum();
            cx = nextNum(); cy = nextNum();
            addPoint(x1, y1); addPoint(cx, cy);
            break;
          }
          case 'q': {
            const x1 = cx + nextNum(), y1 = cy + nextNum();
            cx += nextNum(); cy += nextNum();
            addPoint(x1, y1); addPoint(cx, cy);
            break;
          }
          case 'T': cx = nextNum(); cy = nextNum(); addPoint(cx, cy); break;
          case 't': cx += nextNum(); cy += nextNum(); addPoint(cx, cy); break;
          case 'A': case 'a': {
            // Arc: skip rx, ry, x-rotation, large-arc, sweep; only use endpoint
            nextNum(); nextNum(); nextNum(); nextNum(); nextNum();
            if (cmd === 'A') { cx = nextNum(); cy = nextNum(); }
            else { cx += nextNum(); cy += nextNum(); }
            addPoint(cx, cy);
            break;
          }
          case 'Z': case 'z': break; // close path, no coordinates
          default: break;
        }
      } else {
        i++; // skip unexpected token
      }
    }
  }

  /**
   * Andrew's Monotone Chain Convex Hull algorithm.
   * Returns vertices in counter-clockwise order.
   * Time: O(n log n), Space: O(n). Zero dependencies.
   */
  private convexHull(points: [number, number][]): [number, number][] {
    const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length <= 2) return pts;

    const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
      (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);

    // Build lower hull
    const lower: [number, number][] = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
        lower.pop();
      lower.push(p);
    }

    // Build upper hull
    const upper: [number, number][] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0)
        upper.pop();
      upper.push(pts[i]);
    }

    // Remove last point of each half because it's repeated
    lower.pop();
    upper.pop();

    return lower.concat(upper);
  }

  /**
   * Compute the centroid of a polygon using the signed-area formula.
   */
  private polygonCentroid(vertices: [number, number][]): [number, number] {
    let area = 0;
    let cx = 0;
    let cy = 0;
    const n = vertices.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = vertices[i][0] * vertices[j][1] - vertices[j][0] * vertices[i][1];
      area += cross;
      cx += (vertices[i][0] + vertices[j][0]) * cross;
      cy += (vertices[i][1] + vertices[j][1]) * cross;
    }

    area /= 2;
    if (Math.abs(area) < 1e-10) {
      // Degenerate polygon — fall back to arithmetic mean
      const sumX = vertices.reduce((s, v) => s + v[0], 0);
      const sumY = vertices.reduce((s, v) => s + v[1], 0);
      return [sumX / n, sumY / n];
    }

    cx /= (6 * area);
    cy /= (6 * area);
    return [cx, cy];
  }


}


