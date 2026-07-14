import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from './update-application-status.dto';

export class ApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  offerId: string;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiProperty({ example: 85.5 })
  score?: number;

  @ApiProperty()
  testResults?: any;

  @ApiProperty()
  interviewDate?: Date;

  @ApiProperty()
  interviewLink?: string;

  @ApiProperty()
  decisionDate?: Date;

  @ApiProperty()
  decisionReason?: string;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  offer: {
    id: string;
    title: string;
    diploma: string;
    school: {
      id: string;
      name: string;
      city: string;
    };
  };

  @ApiProperty({ type: [Object] })
  timeline: {
    id: string;
    status: ApplicationStatus;
    note: string;
    createdAt: Date;
  }[];
}
