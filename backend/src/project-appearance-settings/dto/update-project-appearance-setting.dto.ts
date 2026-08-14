import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectAppearanceSettingDto } from './create-project-appearance-setting.dto';

export class UpdateProjectAppearanceSettingDto extends PartialType(CreateProjectAppearanceSettingDto) {}
