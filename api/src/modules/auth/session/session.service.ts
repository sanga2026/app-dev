import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionEntity } from './entities/session.entity';
import { simplifyUserAgent } from './session-utils';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
  ) {}

  // modules/session/session.service.ts

  async createSession(data: {
    userId: string;
    device: string;
    ipAddress: string;
    refreshTokenHash: string;
  }): Promise<SessionEntity> {
    // 🔍 1. Check if an active session already exists for this specific Device & IP
    const existingSession = await this.sessionRepo.findOne({
      where: {
        userId: data.userId,
        device: data.device,
        ipAddress: data.ipAddress,
        isActive: true, // Only match currently active ones
      },
    });

    if (existingSession) {
      // 🔄 2. UPDATE: If it exists, just refresh the activity and token
      existingSession.lastActive = new Date();
      existingSession.refreshTokenHash = data.refreshTokenHash;
      return await this.sessionRepo.save(existingSession);
    }

    // ✨ 3. INSERT: If no match, create a brand new session entry
    const newSession = this.sessionRepo.create({
      ...data,
      isActive: true,
    });

    return await this.sessionRepo.save(newSession);
  }
  /**
   * 📡 Fetch all active sessions for a user
   */
  /**
   * 🛡️ Hacker-Free & Performant Session Retrieval
   * @param userId - Extracted from verified JWT
   * @param currentUA - Raw User-Agent from current request headers
   * @param currentIP - IP address from current request
   */

  /**
   * Centralizes the 'isCurrent' identification logic to protect the active session.
   */
async findAllByUserId(
    userId: string,
    currentUA?: string,
    currentIP?: string,
  ): Promise<any[]> {
    // 1. Database Optimization: Fetch active sessions
    const sessions = await this.sessionRepo.find({
      where: {
        userId,
        isActive: true,
      },
      order: {
        lastActive: 'DESC', // Initial chronological sort
      },
    });

    // 2. Normalize Current Metadata
    const rawUA = currentUA || '';
    const rawIP = currentIP || '';
    const simplifiedCurrentUA = simplifyUserAgent(rawUA);

    const normalize = (ip: string) =>
      ip === '::1' || ip.includes('127.0.0.1') ? '127.0.0.1' : ip;

    const normalizedCurrentIP = normalize(rawIP);

    // 3. Mapping, Identification & Final Sorting
    return sessions
      .map((session) => {
        const normalizedStoredIP = normalize(session.ipAddress);

        // 🛡️ The Security Match
        const isCurrent =
          session.device === simplifiedCurrentUA &&
          normalizedStoredIP === normalizedCurrentIP;

        return {
          id: session.id,
          device: session.device,
          ipAddress: session.ipAddress,
          lastActive: session.lastActive,
          isCurrent: isCurrent,
        };
      })
      .sort((a, b) => {
        // 🚀 THE ADJUSTMENT: 
        // If 'a' is current, move it to the top (-1)
        // If 'b' is current, move it to the top (1)
        // Otherwise, keep the original 'DESC' order (0)
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return 0;
      });
  }

  // modules/session/session.service.ts

async isSessionActive(sessionId: string): Promise<boolean> {
  const session = await this.sessionRepo.findOne({
    where: { 
      id: sessionId, 
      isActive: true 
    },
  });
  
  // Returns true if found and active, false otherwise
  return !!session; 
}
  /**
   * 🚫 Revoke a specific session
   */
  async revoke(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('MESSAGES.SESSION_NOT_FOUND');

    // 🛡️ IDOR Protection: User can only kill their own sessions
    if (session.userId !== userId) {
      throw new ForbiddenException('MESSAGES.UNAUTHORIZED_REVOKE');
    }

    await this.sessionRepo.delete(sessionId);
  }
}
