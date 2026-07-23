import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class CadConfigService {
  constructor(private configService: ConfigService) {}

  get odaConverterPath(): string {
    return this.configService.get<string>('ODA_CONVERTER_PATH') || '';
  }

  get workingDirectory(): string {
    return this.configService.get<string>('WORKING_DIRECTORY') || path.join(process.cwd(), 'uploads', 'cad');
  }

  get tempDirectory(): string {
    return this.configService.get<string>('TEMP_DIRECTORY') || path.join(this.workingDirectory, 'temp');
  }

  get outputDirectory(): string {
    return this.configService.get<string>('OUTPUT_DIRECTORY') || this.workingDirectory;
  }
}
