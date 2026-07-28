import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TeachingService } from './teaching.service';
class ChapterDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
}
class ResourceDto {
  @IsString() @MaxLength(160) title: string;
  @IsUrl({ require_tld: false }) url: string;
  @IsString() @MaxLength(30) type: string;
}
@ApiTags('teaching')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER')
@Controller('teacher/courses')
export class TeachingController {
  constructor(private readonly teaching: TeachingService) {}
  @Get() courses(@GetUser('id') id: string) {
    return this.teaching.courses(id);
  }
  @Get(':courseId') detail(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.teaching.detail(id, courseId);
  }
  @Get(':courseId/students') students(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.teaching.students(id, courseId);
  }
  @Post(':courseId/chapters') chapter(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: ChapterDto,
  ) {
    return this.teaching.createChapter(id, courseId, dto);
  }
  @Patch(':courseId/chapters/:chapterId/publish') publish(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.teaching.publishChapter(id, courseId, chapterId);
  }
  @Post(':courseId/chapters/:chapterId/resources') resource(
    @GetUser('id') id: string,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: ResourceDto,
  ) {
    return this.teaching.addResource(id, courseId, chapterId, dto);
  }
}
