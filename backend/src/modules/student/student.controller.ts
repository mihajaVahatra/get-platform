import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentService } from './student.service';
import { StorageService, ImageEntityType, ImageType } from '../../common/services/storage.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { OrientationQuestionnaireDto } from './dto/orientation-questionnaire.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('students')
@Controller('students')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly storageService: StorageService,
  ) {}

  // ========== PROFILE ==========

  @Get('me')
  @ApiOperation({ summary: 'Get current student profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Student not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User is not a student' })
  async getProfile(@GetUser() user: any) {
    if (!user.student) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux étudiants');
    }
    const profile = await this.studentService.getProfile(user.id);
    return {
      success: true,
      data: profile,
      message: 'Profile retrieved successfully',
    };
  }

  @Put('me')
  @ApiOperation({ summary: 'Update student profile' })
  @ApiBody({ type: UpdateStudentProfileDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid data' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User is not a student' })
  async updateProfile(
    @GetUser() user: any,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    if (!user.student) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux étudiants');
    }
    const profile = await this.studentService.updateProfile(user.id, dto);
    return {
      success: true,
      data: profile,
      message: 'Profile updated successfully',
    };
  }

  // ========== AVATAR ==========

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload student avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Avatar uploaded' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Seules les images sont autorisées'), false);
      }
    },
  }))
  async uploadAvatar(
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!user.student) {
      throw new ForbiddenException('Réservé aux étudiants');
    }
    if (!file) {
      throw new BadRequestException('Aucun fichier uploadé');
    }

    const result = await this.storageService.uploadImage(file, {
      entityType: ImageEntityType.STUDENT,
      entityId: user.student.id,
      type: ImageType.AVATAR,
    });

    await this.studentService.updateAvatar(user.id, result.url);

    return {
      success: true,
      data: { avatarUrl: result.url },
      message: 'Avatar uploaded successfully',
    };
  }

  // ========== DOCUMENTS ==========

  @Get('me/documents')
  @ApiOperation({ summary: 'Get all documents' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Documents retrieved' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User is not a student' })
  async getDocuments(@GetUser() user: any) {
    if (!user.student) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux étudiants');
    }
    const documents = await this.studentService.getDocuments(user.id);
    return {
      success: true,
      data: documents,
      message: 'Documents retrieved',
    };
  }

  @Post('me/documents')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: ['CV', 'LETTER', 'ID', 'DIPLOMA', 'PHOTO', 'OTHER'] },
        name: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Document uploaded' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'File too large or unsupported format' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User is not a student' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Unsupported file format. Accepted: PDF, JPG, PNG, DOC, DOCX'), false);
      }
    },
  }))
  async uploadDocument(
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    if (!user.student) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux étudiants');
    }
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const document = await this.studentService.uploadDocument(user.id, file, dto);
    return {
      success: true,
      data: document,
      message: 'Document uploaded successfully',
    };
  }

  @Delete('me/documents/:id')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Document deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User is not a student' })
  async deleteDocument(
    @GetUser() user: any,
    @Param('id') documentId: string,
  ) {
    if (!user.student) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux étudiants');
    }
    await this.studentService.deleteDocument(user.id, documentId);
    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }

  // ========== ORIENTATION ==========

  @Post('me/orientation')
  @ApiOperation({ summary: 'Submit orientation questionnaire' })
  @ApiBody({ type: OrientationQuestionnaireDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Questionnaire submitted' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User is not a student' })
  async submitOrientationQuestionnaire(
    @GetUser() user: any,
    @Body() dto: OrientationQuestionnaireDto,
  ) {
    if (!user.student) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux étudiants');
    }
    const suggestions = await this.studentService.submitOrientationQuestionnaire(user.id, dto);
    return {
      success: true,
      data: { suggestions },
      message: 'Questionnaire submitted successfully',
    };
  }

  @Get('me/orientation')
  @ApiOperation({ summary: 'Get orientation suggestions' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Orientation suggestions retrieved' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User is not a student' })
  async getOrientationSuggestions(@GetUser() user: any) {
    if (!user.student) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux étudiants');
    }
    const suggestions = await this.studentService.getOrientationSuggestions(user.id);
    return {
      success: true,
      data: { suggestions },
      message: 'Orientation suggestions retrieved',
    };
  }

  // ========== STATISTICS ==========

  @Get('me/stats')
  @ApiOperation({ summary: 'Get personal statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistics retrieved' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User is not a student' })
  async getStudentStats(@GetUser() user: any) {
    if (!user.student) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux étudiants');
    }
    const stats = await this.studentService.getStudentStats(user.id);
    return {
      success: true,
      data: stats,
      message: 'Statistics retrieved',
    };
  }
}
