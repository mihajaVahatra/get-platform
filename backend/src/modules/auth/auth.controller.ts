import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setSessionCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const secure = this.config.get('NODE_ENV') === 'production';
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  // ========== REGISTER ==========
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.register(dto);
    this.setSessionCookies(response, accessToken, refreshToken);
    return { user };
  }

  // ========== LOGIN ==========
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setSessionCookies(response, accessToken, refreshToken);
    return { user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async me(@GetUser() user: any) {
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        gender: user.gender,
        firstName: user.student?.firstName || user.email.split('@')[0],
        lastName: user.student?.lastName || '',
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token', { path: '/' });
    response.clearCookie('refresh_token', { path: '/' });
  }

  // ========== FORGOT PASSWORD ==========
  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ schema: { properties: { email: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Reset email sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  // ========== RESET PASSWORD ==========
  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({
    schema: {
      properties: {
        token: { type: 'string' },
        newPassword: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid token or password' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ========== MFA ==========
  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN', 'MINISTRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Enable MFA for admin' })
  @ApiResponse({ status: 200, description: 'MFA QR code generated' })
  async enableMfa(@GetUser('id') userId: string) {
    return this.authService.enableMfa(userId);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN', 'MINISTRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify and enable MFA' })
  @ApiBody({
    schema: { properties: { code: { type: 'string', example: '123456' } } },
  })
  async verifyMfa(@GetUser('id') userId: string, @Body('code') code: string) {
    return this.authService.verifyMfa(userId, code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN', 'MINISTRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiBody({
    schema: { properties: { code: { type: 'string', example: '123456' } } },
  })
  async disableMfa(@GetUser('id') userId: string, @Body('code') code: string) {
    return this.authService.disableMfa(userId, code);
  }
}
