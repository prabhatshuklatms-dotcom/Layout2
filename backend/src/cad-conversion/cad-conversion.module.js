"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CadConversionModule = void 0;
const common_1 = require("@nestjs/common");
const cad_conversion_controller_1 = require("./cad-conversion.controller");
const cad_conversion_service_1 = require("./cad-conversion.service");
const conversion_pipeline_service_1 = require("./conversion-pipeline.service");
const cad_config_service_1 = require("./cad-config.service");
const prisma_module_1 = require("../prisma/prisma.module");
let CadConversionModule = class CadConversionModule {
};
exports.CadConversionModule = CadConversionModule;
exports.CadConversionModule = CadConversionModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [cad_conversion_controller_1.CadConversionController],
        providers: [cad_conversion_service_1.CadConversionService, conversion_pipeline_service_1.ConversionPipelineService, cad_config_service_1.CadConfigService],
    })
], CadConversionModule);
//# sourceMappingURL=cad-conversion.module.js.map