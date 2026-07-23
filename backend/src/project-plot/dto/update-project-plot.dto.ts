import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectPlotDto } from './create-project-plot.dto';

export class UpdateProjectPlotDto extends PartialType(CreateProjectPlotDto) {}
