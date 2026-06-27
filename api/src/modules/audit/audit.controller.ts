// src/audit/audit.controller.ts
import { Controller, ForbiddenException, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) // 🛡️ Identity + Structural + Functional Check
@Controller('audit')
// @UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

@Get('logs/:userId')
  async getUserLogs(
    @Param('userId') requestedUserId: string,
    @Query('limit') limit: string,  // 📥 Incoming from Frontend params
    @Query('offset') offset: string, // 📥 Incoming from Frontend params
    @Req() req: any
  ) {
    const loggedInUserId = req.user.id;
    const loggedInUserRole = req.user.roleName || req.user.role;

    // 🛡️ SECURITY BARRIER (IDOR Protection)
    if (loggedInUserId !== requestedUserId && loggedInUserRole !== 'Super Admin') {
      throw new ForbiddenException('Security Violation: You are not authorized to view these access logs.');
    }

    // 🔢 Parse and Validate Pagination (Hacker-Free Parsing)
    // We use a fallback (10 and 0) in case the frontend doesn't send them
    const parsedLimit = Math.min(parseInt(limit, 10) || 10, 100); // Max 100 to prevent DB stress
    const parsedOffset = parseInt(offset, 10) || 0;

    // Pass the parsed numbers to your Audit Service
    return this.auditService.getUserLogs(requestedUserId, parsedLimit, parsedOffset); 
  }
}