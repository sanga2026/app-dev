import { Controller, Get, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

// modules/session/session.controller.ts

@Get()
@UseGuards(JwtAuthGuard)
async getMySessions(@Req() req: any) {
  // 🛡️ Log here to make sure the controller actually sees the data
  // console.log('Controller User-Agent:', req.headers['user-agent']);
  // console.log('Controller IP:', req.ip);

  return this.sessionService.findAllByUserId(
    req.user.id, 
    req.headers['user-agent'], // 👈 This was likely missing or misspelled
    req.ip || req.connection.remoteAddress // 👈 This was likely missing
  );
}

  @Delete(':id')
  async revokeSession(@Param('id') sessionId: string, @Req() req: any) {
    return this.sessionService.revoke(sessionId, req.user.id);
  }
}