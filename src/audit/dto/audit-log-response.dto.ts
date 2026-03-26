import { ApiProperty } from '@nestjs/swagger';

export class AuditLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  userId!: string | null;

  @ApiProperty({ nullable: true })
  secretId!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedAuditLogsDto {
  @ApiProperty({ type: [AuditLogDto] })
  data!: AuditLogDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
