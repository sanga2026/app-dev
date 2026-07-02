import {
  Injectable, UnauthorizedException, ForbiddenException,
  Logger, InternalServerErrorException, HttpException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserEntity } from '../users/entities/user.entity';
import { MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ForgotPasswordDto } from '../users/dto/forgot-password.dto';
import { MailService } from './mail/mail.service';
import { ResetPasswordDto } from '../users/dto/reset-password.dto';
import { SessionService } from './session/session.service';
import { getErrorMessage } from '../../common/utils/error-handler.util';
import { simplifyUserAgent } from './session/session-utils';
import { LoginDto } from './dto/login.dto';

export interface LoginPayload { identifier: string; password: string; }

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly mailService: MailService,
    private readonly sessionService: SessionService,
  ) {}

  private signTokens(userId: string, sessionId: string, user: UserEntity) {
    const payload = {
      sub: userId, sessionId,
      username: user.username, email: user.email,
      role: user.role?.role, bankId: user.bankId, branchId: user.branchId,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRATION') || '8h') as any,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('REFRESH_TOKEN_EXPIRATION') || '7d') as any,
    });
    return { accessToken, refreshToken };
  }

  async login(loginDto: LoginDto, req: any) {
    try {
      const { identifier, password } = loginDto;
      const user = await this.usersService.findByIdentifier(identifier);
      if (!user || !user.password) throw new UnauthorizedException('Invalid email/username or password.');
      if (!user.isActive) throw new ForbiddenException('Account deactivated. Please contact your administrator.');
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) throw new UnauthorizedException('Invalid email/username or password.');

      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ipAddress = req.ip || req.connection?.remoteAddress || '0.0.0.0';
      const cleanDeviceName = simplifyUserAgent(userAgent);

      let sessionId: string | null = null;
      try {
        const session = await this.sessionService.createSession({
          userId: user.id, device: cleanDeviceName, ipAddress,
          refreshTokenHash: `TEMP_${user.id}_${Date.now()}`,
        });
        sessionId = session.id;
      } catch (e) {
        this.logger.error(`[SESSION_ERROR] ${user.id}: ${getErrorMessage(e)}`);
      }

      const { accessToken, refreshToken } = this.signTokens(user.id, sessionId!, user);
      if (sessionId) {
        const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await this.sessionService.updateRefreshTokenHash(sessionId, hash);
      }
      this.recordLogin(user.id);

      return {
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id, username: user.username,
          fullName: `${user.firstName} ${user.lastName}`,
          email: user.email, role: user.role?.role, roleName: user.role?.name,
          permissions: user.role?.permissions || {},
          bankId: user.bankId, branchId: user.branchId,
          firstName: user.firstName, lastName: user.lastName,
          phoneNumber: user.phoneNumber, roleType: user.roleType,
        },
      };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException('An unexpected error occurred.');
    }
  }

  async refreshTokens(userId: string, sessionId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['role'] });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found or deactivated.');
    const { accessToken, refreshToken: newRT } = this.signTokens(userId, sessionId, user);
    const hash = crypto.createHash('sha256').update(newRT).digest('hex');
    await this.sessionService.updateRefreshTokenHash(sessionId, hash);
    return { access_token: accessToken, refresh_token: newRT };
  }

  async recordLogin(userId: string): Promise<void> {
    try { await this.userRepo.update(userId, { lastLoginAt: new Date() }); }
    catch (e) { this.logger.error(`recordLogin failed: ${getErrorMessage(e)}`); }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    try {
      const user = await this.userRepo.findOne({ where: { email: forgotPasswordDto.email } });
      if (!user) return { message: 'If an account exists, a reset link has been sent.' };
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date();
      expires.setHours(expires.getHours() + 1);
      user.resetToken = token;
      user.resetTokenExpires = expires;
      await this.userRepo.save(user);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const resetLink = `${frontendUrl}/reset-password?token=${token}`;
      await this.mailService.sendPasswordReset(user.username, resetLink);
      return { message: 'If an account exists, a reset link has been sent.' };
    } catch (e) {
      this.logger.error('Forgot password error:', e);
      throw new InternalServerErrorException('Error processing request');
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;
    try {
      const user = await this.userRepo.findOne({
        where: { resetToken: token, resetTokenExpires: MoreThan(new Date()) },
      });
      if (!user) throw new BadRequestException('The reset link is invalid or has expired.');
      user.password = await bcrypt.hash(password, await bcrypt.genSalt(12));
      user.resetToken = null;
      user.resetTokenExpires = null;
      await this.userRepo.save(user);
      return { success: true, message: 'Password successfully updated.' };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('An unexpected error occurred during password reset.');
    }
  }
}
