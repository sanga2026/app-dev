// src/modules/auth/auth.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from '../users/dto/forgot-password.dto';
import { ResetPasswordDto } from '../users/dto/reset-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // Strict rate limit: max 5 login attempts per minute per IP
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    if (!loginDto.identifier || !loginDto.password) {
      throw new UnauthorizedException('Email/Username and password are required.');
    }

    try {
      return await this.authService.login(loginDto, req);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[AUTH_FAILED]: Login failed for '${loginDto.identifier}'. Reason: ${errorMessage}`);
      throw error;
    }
  }

  // Strict rate limit: max 3 password reset requests per minute per IP
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  // Refresh tokens — protected by JwtRefreshGuard (validates refresh token)
  @SkipThrottle()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: any) {
    const { sub: userId, sessionId } = req.user;
    return this.authService.refreshTokens(userId, sessionId);
  }
}
