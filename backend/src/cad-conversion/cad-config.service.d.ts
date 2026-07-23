import { ConfigService } from '@nestjs/config';
export declare class CadConfigService {
    private configService;
    constructor(configService: ConfigService);
    get odaConverterPath(): string;
    get workingDirectory(): string;
    get tempDirectory(): string;
    get outputDirectory(): string;
}
