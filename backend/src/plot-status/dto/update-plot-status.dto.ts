import { PartialType } from '@nestjs/mapped-types';
import { CreatePlotStatusDto } from './create-plot-status.dto';

export class UpdatePlotStatusDto extends PartialType(CreatePlotStatusDto) {}
