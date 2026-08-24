import {
    Controller,
    Delete,
    Get,
    HttpStatus,
    Post,
    UploadedFile,
    UseGuards,
    UseInterceptors,
    ParseFilePipeBuilder,
    HttpCode,
    Param,
    ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const MAX_PDF_SIZE = 10 * 1024 * 1024;

type AuthenticatedUser = {
    id: string;
    email: string;
};

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Get()
    findAll(@CurrentUser() user: AuthenticatedUser) {
        return this.documentsService.findAll(user.id);
    }
    @Post('upload')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {
                files: 1,
                fileSize: MAX_PDF_SIZE,
            },
        }),
    )
    upload(
        @CurrentUser() user: AuthenticatedUser,

        @UploadedFile(
            new ParseFilePipeBuilder()
                .addFileTypeValidator({
                    fileType: 'application/pdf',
                })
                .addMaxSizeValidator({
                    maxSize: MAX_PDF_SIZE,
                })
                .build({
                    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                }),
        )
        file: Express.Multer.File,
    ) {
        return this.documentsService.upload(user.id, file);
    }

    @Post(':id/retry')
    @HttpCode(HttpStatus.OK)
    retryProcessing(
        @CurrentUser()
        user: AuthenticatedUser,

        @Param(
            'id',
            new ParseUUIDPipe({
                version: '4',
            }),
        )
        documentId: string,
    ) {
        return this.documentsService.retryProcessing(user.id, documentId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @CurrentUser() user: AuthenticatedUser,

        @Param(
            'id',
            new ParseUUIDPipe({
                version: '4',
            }),
        )
        documentId: string,
    ) {
        await this.documentsService.remove(user.id, documentId);
    }
}
