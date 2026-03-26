import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// Coût bcrypt minimum requis
const BCRYPT_COST_FACTOR = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Vérifier si l'email est déjà pris
    const existing = await this.prisma.user.findUnique({
      select: { id: true },
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException('Registration failed');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

    const user = await this.prisma.user.create({
      select: { id: true, email: true, role: true },
      data: {
        email: dto.email,
        password: hashedPassword,
      },
    });

    return this.generateTokenResponse(user.id, user.email, user.role);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // select explicite — ne jamais exposer d'autres champs
    const user = await this.prisma.user.findUnique({
      select: { id: true, email: true, password: true, role: true },
      where: { email: dto.email },
    });

    if (!user) {
      // Message générique pour ne pas révéler si l'email existe
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokenResponse(user.id, user.email, user.role);
  }

  private generateTokenResponse(
    userId: string,
    email: string,
    role: string,
  ): AuthResponseDto {
    // expiresIn configuré dans JwtModule.registerAsync — pas besoin de le passer ici
    const payload = { sub: userId, email, role };

    return {
      accessToken: this.jwtService.sign(payload),
      role,
    };
  }
}
