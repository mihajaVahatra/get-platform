import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ enum: ['CV', 'LETTER', 'ID', 'DIPLOMA', 'PHOTO', 'OTHER'] })
  @IsIn(['CV', 'LETTER', 'ID', 'DIPLOMA', 'PHOTO', 'OTHER'])
  type: string;

  @ApiProperty({ example: 'CV_Jean_Rakoto.pdf' })
  @IsString()
  name: string;
}

export class DocumentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'CV' })
  type: string;

  @ApiProperty({ example: 'CV_Jean_Rakoto.pdf' })
  name: string;

  @ApiProperty({ example: 'https://s3.get.mg/documents/cv-123.pdf' })
  fileUrl: string;

  @ApiProperty({ example: 2048576 })
  fileSize: number;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  uploadedAt: Date;
}
