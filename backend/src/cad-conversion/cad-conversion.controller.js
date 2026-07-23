"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CadConversionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const cad_conversion_service_1 = require("./cad-conversion.service");
const conversion_pipeline_service_1 = require("./conversion-pipeline.service");
const multer_1 = require("multer");
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
let CadConversionController = class CadConversionController {
    cadConversionService;
    conversionPipeline;
    constructor(cadConversionService, conversionPipeline) {
        this.cadConversionService = cadConversionService;
        this.conversionPipeline = conversionPipeline;
    }
    async uploadFile(file) {
        if (!file)
            throw new common_1.BadRequestException('File is required');
        if (!fs.existsSync('./uploads/cad')) {
            fs.mkdirSync('./uploads/cad', { recursive: true });
        }
        const conversion = await this.cadConversionService.create({
            originalFileName: file.originalname,
            originalFilePath: file.path,
            fileSize: file.size,
            status: 'PENDING'
        });
        this.conversionPipeline.runPipeline(conversion.id, file.path, file.originalname).catch(console.error);
        return conversion;
    }
    async findAll() {
        return this.cadConversionService.findAll();
    }
    async findOne(id) {
        return this.cadConversionService.findOne(+id);
    }
    async getSvg(id, res) {
        const conversion = await this.cadConversionService.findOne(+id);
        if (!conversion.svgFilePath || !fs.existsSync(conversion.svgFilePath)) {
            throw new common_1.BadRequestException('SVG file not available');
        }
        res.setHeader('Content-Type', 'image/svg+xml');
        res.sendFile(path.resolve(conversion.svgFilePath));
    }
    async remove(id) {
        return this.cadConversionService.remove(+id);
    }
};
exports.CadConversionController = CadConversionController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads/cad',
            filename: (req, file, cb) => {
                const uniqueSuffix = (0, uuid_1.v4)() + path.extname(file.originalname);
                cb(null, uniqueSuffix);
            }
        }),
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            if (ext !== '.dxf' && ext !== '.dwg') {
                return cb(new common_1.BadRequestException('Only .dxf and .dwg files are allowed'), false);
            }
            cb(null, true);
        }
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CadConversionController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CadConversionController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CadConversionController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/svg'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CadConversionController.prototype, "getSvg", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CadConversionController.prototype, "remove", null);
exports.CadConversionController = CadConversionController = __decorate([
    (0, common_1.Controller)('api/cad-conversion'),
    __metadata("design:paramtypes", [cad_conversion_service_1.CadConversionService,
        conversion_pipeline_service_1.ConversionPipelineService])
], CadConversionController);
//# sourceMappingURL=cad-conversion.controller.js.map