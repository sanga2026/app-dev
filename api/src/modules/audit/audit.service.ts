import { 
  Injectable, 
  Logger, 
  NotFoundException, 
  BadRequestException, 
  InternalServerErrorException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLogEntity } from './entities/access-log.entity';
import { UserEntity } from '../users/entities/user.entity';
import { getErrorMessage } from '../../common/utils/error-handler.util';

@Injectable()
export class AuditService {
  // 🚀 Standardize internal logging for your backend console/monitoring tools
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AccessLogEntity)
    private readonly logRepository: Repository<AccessLogEntity>,
    // 🚀 Injecting UserRepository to validate user existence
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>, 
  ) {}

  /**
   * 📝 Creates an access log entry for a specific event
   */
  async createLog(userId: string, event: string, ip: string, userAgent: string): Promise<AccessLogEntity> {
    // 1. Basic Input Validation
    if (!userId || !event) {
      throw new BadRequestException('User ID and Event description are required to create an audit log.');
    }

    try {
      // 2. Validate User Existence (Foreign Key Integrity)
      const userExists = await this.userRepository.exists({ where: { id: userId } });
      if (!userExists) {
        this.logger.warn(`Security Warning: Attempted to log event '${event}' for non-existent user ID: ${userId}`);
        throw new NotFoundException('Cannot create access log: User does not exist.');
      }

      // 3. Create and Save Log
      const log = this.logRepository.create({
        userId,
        event,
        ipAddress: ip || '0.0.0.0', // Fallback for missing IP
        device: this.parseUserAgent(userAgent),
      });

      return await this.logRepository.save(log);

    } catch (error) {
      // Re-throw our known HTTP exceptions so they reach the controller
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Catch DB errors (like connection drops) and log internally
      this.logger.error(`Database error creating log for user ${userId}: ${getErrorMessage(error)}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('A critical error occurred while saving the audit log.');
    }
  }

  /**
   * 📖 Retrieves the most recent access logs for a user
   */
async getUserLogs(
   userId: string, limit: number, offset: number
  ): Promise<AccessLogEntity[]> {
    // 1. Strict Input Validation
    if (!userId) {
      throw new BadRequestException('User ID is required to fetch user logs'); // Using keys for translation support
    }

    // 2. Hacker-Free Bounds Checking
    // Prevents DB strain by capping limit and ensuring offset isn't negative
    const safeLimit = Math.min(Math.max(1, limit), 50); 
    const safeOffset = Math.max(0, offset);

    try {
      // 3. Optimized User Existence Check
      // Use .count() or .exists() to avoid loading full user object into memory
      const userExists = await this.userRepository.exists({ where: { id: userId } });
      
      if (!userExists) {
        this.logger.warn(`⚠️ Unauthorized Log Access: User ID ${userId} does not exist.`);
        // We throw a specific message that the Frontend 'showDirectToast' will display
        throw new NotFoundException('User profile could not be verified. Access logs unavailable.');
      }

      // 4. Paginated Database Query
      const logs = await this.logRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' }, // Keep latest logs at the top
        take: safeLimit,              // SQL LIMIT
        skip: safeOffset,             // SQL OFFSET (The fix for your "repeating data" issue)
      });

      return logs;

    } catch (error) {
      // 5. Intelligent Exception Bubbling
      // If it's a known error (400, 404), throw it directly so the message reaches the Frontend
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      // 6. Internal Sanitization
      // Log the real system error for the developer, but give the user a clean, non-technical message
      this.logger.error(`🔥 DB Sync Error [User: ${userId}]: ${getErrorMessage(error)}`, error instanceof Error ? error.stack : String(error));
      
      throw new InternalServerErrorException('System Synchronization Error: Unable to communicate with the audit database.');
    }
  }

  /**
   * 🛠️ Helper to simplify User-Agent strings into readable UI text
   */
  private parseUserAgent(ua: string): string {
    try {
      if (!ua) return 'Unknown Device';
      
      const uaLower = ua.toLowerCase();
      
      if (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) {
        if (uaLower.includes('safari') && !uaLower.includes('chrome')) return 'Safari (Mobile)';
        if (uaLower.includes('chrome')) return 'Chrome (Mobile)';
        return 'Mobile Device';
      }

      if (uaLower.includes('chrome')) return 'Chrome (Desktop)';
      if (uaLower.includes('safari')) return 'Safari (Desktop)';
      if (uaLower.includes('firefox')) return 'Firefox (Desktop)';
      if (uaLower.includes('edge')) return 'Edge (Desktop)';

      return 'Unknown Browser';
    } catch (error) {
      this.logger.error('Error parsing User-Agent string', error);
      return 'System Device';
    }
  }
}