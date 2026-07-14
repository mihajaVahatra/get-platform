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
import { StudentService } from './student.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { OrientationQuestionnaireDto } from './dto/orientation-questionnaire.dto';
import { UploadDocumentDto, DocumentResponseDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('students')
@Controller('students')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  // ========== PROFILE ==========

  @Get('me')
  @ApiOperation({ summary: 'Get current student profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Student not found' })
  async getProfile(@GetUser('id') userId: string) {
    const profile = await this.studentService.getProfile(userId);
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
  async updateProfile(
    @GetUser('id') userId: string,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    const profile = await this.studentService.updateProfile(userId, dto);
    return {
      success: true,
      data: profile,
      message: 'Profile updated successfully',
    };
  }

  // ========== DOCUMENTS ==========

  @Get('me/documents')
  @ApiOperation({ summary: 'Get all documents' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Documents retrieved' })
  async getDocuments(@GetUser('id') userId: string) {
    const documents = await this.studentService.getDocuments(userId);
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
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
    @GetUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const document = await this.studentService.uploadDocument(userId, file, dto);
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
  async deleteDocument(
    @GetUser('id') userId: string,
    @Param('id') documentId: string,
  ) {
    await this.studentService.deleteDocument(userId, documentId);
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
  async submitOrientationQuestionnaire(
    @GetUser('id') userId: string,
    @Body() dto: OrientationQuestionnaireDto,
  ) {
    const suggestions = await this.studentService.submitOrientationQuestionnaire(userId, dto);
    return {
      success: true,
      data: { suggestions },
      message: 'Questionnaire submitted successfully',
    };
  }

  @Get('me/orientation')
  @ApiOperation({ summary: 'Get orientation suggestions' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Orientation suggestions retrieved' })
  async getOrientationSuggestions(@GetUser('id') userId: string) {
    const suggestions = await this.studentService.getOrientationSuggestions(userId);
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
  async getStudentStats(@GetUser('id') userId: string) {
    const stats = await this.studentService.getStudentStats(userId);
    return {
      success: true,
      data: stats,
      message: 'Statistics retrieved',
    };
  }
}
