import { Body, Controller, Get, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageService } from './message.service';

@ApiTags('messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('inbox')
  @ApiOperation({ summary: 'Get my inbox' })
  async inbox(@GetUser('id') userId: string, @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 30) {
    const result = await this.messageService.getInbox(userId, page, limit);
    return { success: true, data: result.items, meta: result.meta };
  }

  @Get('sent')
  @ApiOperation({ summary: 'Get my sent messages' })
  async sent(@GetUser('id') userId: string, @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 30) {
    const result = await this.messageService.getSent(userId, page, limit);
    return { success: true, data: result.items, meta: result.meta };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get my unread message count' })
  async unreadCount(@GetUser('id') userId: string) {
    return { success: true, data: await this.messageService.unreadCount(userId) };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get my direct-message conversations' })
  async conversations(@GetUser('id') userId: string, @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 30) {
    const result = await this.messageService.getConversations(userId, page, limit);
    return { success: true, data: result.items, meta: result.meta };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a direct-message thread' })
  async thread(@Param('id') conversationId: string, @GetUser('id') userId: string, @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 50) {
    const result = await this.messageService.getThread(conversationId, userId, page, limit);
    return { success: true, data: result.items, meta: result.meta };
  }

  @Post()
  @ApiOperation({ summary: 'Send a message to a user by email' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Message sent' })
  async send(@GetUser('id') userId: string, @Body() dto: SendMessageDto) {
    return { success: true, data: await this.messageService.send(userId, dto), message: 'Message envoyé' };
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Mark every received message in a thread as read' })
  async markThreadAsRead(@Param('id') conversationId: string, @GetUser('id') userId: string) {
    return { success: true, data: await this.messageService.markThreadAsRead(conversationId, userId) };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark an inbox message as read' })
  async markAsRead(@Param('id') messageId: string, @GetUser('id') userId: string) {
    return { success: true, data: await this.messageService.markAsRead(messageId, userId) };
  }
}
