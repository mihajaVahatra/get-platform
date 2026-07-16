import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ========== REGISTER ==========
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ========== LOGIN ==========
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ========== FORGOT PASSWORD ==========
  @Public()
  @Post('forgot-password')
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
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
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
  @ApiBody({ schema: { properties: { code: { type: 'string', example: '123456' } } } })
  async verifyMfa(
    @GetUser('id') userId: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyMfa(userId, code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN', 'MINISTRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiBody({ schema: { properties: { code: { type: 'string', example: '123456' } } } })
  async disableMfa(
    @GetUser('id') userId: string,
    @Body('code') code: string,
  ) {
    return this.authService.disableMfa(userId, code);
  }
}
