// src/modules/auth/strategies/jwt.strategy.ts

import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { SessionService } from '../session/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly sessionService : SessionService
  ) {
    const jwtSecret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!jwtSecret) {
      throw new Error('FATAL ERROR: JWT_ACCESS_SECRET is missing in .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * VALIDATE: Rehydrates the user object for every request.
   * This ensures real-time permission enforcement.
   */
  async validate(payload: any) {
    // 🛡️ 1. Extract the ID from the 'sub' (subject) field of the JWT
    const userId = payload.sub;
  const sessionId = payload.sessionId;

    if (!userId) {
      this.logger.error('Invalid JWT Payload: "sub" field is missing.');
      throw new UnauthorizedException('Malformed authentication token.');
    }

        // THE KILL SWITCH: Check if this specific session is still alive
     const isActive = await this.sessionService.isSessionActive(sessionId);
  
  if (!isActive) {
    this.logger.warn(`Access Denied: Session ${sessionId} is revoked/logged out.`);
    throw new UnauthorizedException('Your session has ended. Please log in again.');
  }
  
    // 🛡️ 2. Fetch User + Role + Bank
    // Including 'role' is CRITICAL for RolesGuard and PermissionsGuard
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role', 'bank'], 
    });


    // 🛡️ 3. Real-time Security Checks
    if (!user) {
      this.logger.warn(`Auth Failed: User with ID ${userId} not found in database.`);
      throw new UnauthorizedException('Your session is invalid. User account not found.');
    }

    if (!user.isActive) {
      this.logger.warn(`Auth Blocked: Deactivated user ${user.email} attempted access.`);
      throw new UnauthorizedException('Your account has been deactivated. Please contact your administrator.');
    }

    // 🛡️ 4. Sanity Check: Ensure the role object is actually present
    if (!user.role) {
      this.logger.error(`Security Gap: User ${user.email} is authenticated but has NO assigned role.`);
      throw new UnauthorizedException('Your account profile is incomplete (missing role).');
    }
    // This object becomes 'req.user' available via @CurrentUser()
    return user; 
  }
}