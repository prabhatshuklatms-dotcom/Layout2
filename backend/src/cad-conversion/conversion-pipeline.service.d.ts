import { CadConversionService } from './cad-conversion.service';
import { CadConfigService } from './cad-config.service';
export declare class ConversionPipelineService {
    private readonly cadConversionService;
    private readonly cadConfig;
    private readonly logger;
    constructor(cadConversionService: CadConversionService, cadConfig: CadConfigService);
    runPipeline(conversionId: number, filePath: string, originalName: string): Promise<void>;
    private generateSvgFromDxf;
}
export declare class CadSvgRenderer {
    private data;
    private minX;
    private minY;
    private maxX;
    private maxY;
    private paths;
    private defs;
    private convertedCount;
    private skippedCount;
    private skippedTypes;
    private aciColors;
    constructor(data: any);
    render(): {
        svg: string;
        stats: any;
    };
    private addBounds;
    private getColor;
    private getBulgeArc;
    private processBlocks;
    private sanitizeId;
    private processEntities;
}
