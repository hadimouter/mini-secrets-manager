import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateSecretDto } from './dto/create-secret.dto';
import { CreateSecretResponseDto } from './dto/create-secret-response.dto';
import { SecretResponseDto } from './dto/secret-response.dto';
import { SecretsService } from './secrets.service';

@ApiTags('secrets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('secrets')
export class SecretsController {
  constructor(private readonly service: SecretsService) {}

  @Post()
  @ApiOperation({ summary: 'Store an encrypted secret' })
  @ApiResponse({ status: 201, type: CreateSecretResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @Body() dto: CreateSecretDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ): Promise<CreateSecretResponseDto> {
    return this.service.create(dto, req.user.userId, req.ip ?? null);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve and decrypt a secret' })
  @ApiResponse({ status: 200, type: SecretResponseDto })
  @ApiResponse({ status: 404, description: 'Secret not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ): Promise<SecretResponseDto> {
    return this.service.findById(
      id,
      req.user.userId,
      req.user.role,
      req.ip ?? null,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a secret' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Secret not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ): Promise<void> {
    return this.service.delete(
      id,
      req.user.userId,
      req.user.role,
      req.ip ?? null,
    );
  }
}
