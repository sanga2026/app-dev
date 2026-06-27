// src/modules/auth/guards/jwt-auth.guard.ts

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    
    // 🛡️ 1. Check if the error is specifically a Token Expiry
    if (info instanceof TokenExpiredError) {
      throw new UnauthorizedException('Your session has expired. Please log in again.');
    }

    // 🛡️ 2. Check if the token is malformed or invalid
    if (info instanceof JsonWebTokenError) {
      throw new UnauthorizedException('Invalid session. Please log in again.');
    }

    // 🛡️ 3. Generic Unauthorized (User not found, no token provided, etc.)
    if (err || !user) {
      throw err || new UnauthorizedException('You are not authorized to access this resource.');
    }

    return user;
  }
}