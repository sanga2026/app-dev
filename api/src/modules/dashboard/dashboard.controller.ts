import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get role-scoped dashboard statistics' })
  getStats(@CurrentUser() user: UserEntity) {
    return this.service.getStats(user);
  }

  @Get('charts')
  @ApiOperation({ summary: 'Get time-series chart data with period filter' })
  @ApiQuery({ name: 'period', enum: ['1D','1W','1M','3M','6M','1Y','2Y','3Y'], required: false })
  getCharts(@CurrentUser() user: UserEntity, @Query('period') period = '1M') {
    return this.service.getCharts(user, period);
  }
}
