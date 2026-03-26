import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from './audit.service';
import { PaginatedAuditLogsDto } from './dto/audit-log-response.dto';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List audit logs (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, type: PaginatedAuditLogsDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ): Promise<PaginatedAuditLogsDto> {
    const parsedPage = Math.max(1, Number(page));
    const parsedLimit = Math.min(100, Math.max(1, Number(limit)));
    return this.auditService.findAll(parsedPage, parsedLimit);
  }
}
