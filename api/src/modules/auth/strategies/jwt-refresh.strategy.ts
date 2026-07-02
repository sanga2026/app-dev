import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SessionService } from '../session/session.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('FATAL: JWT_REFRESH_SECRET is missing in .env');

    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken: string = req.body?.refreshToken;
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing.');

    // Validate the session is still active
    const isActive = await this.sessionService.isSessionActive(payload.sessionId);
    if (!isActive) throw new UnauthorizedException('Session expired. Please log in again.');

    return { ...payload, refreshToken };
  }
}
