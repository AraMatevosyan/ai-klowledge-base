import {
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './auth.types';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    async register(dto: RegisterDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: {
                email: dto.email,
            },
            select: {
                id: true,
            },
        });

        if (existingUser) {
            throw new ConflictException(
                'An account with this email already exists.',
            );
        }

        const passwordHash = await hash(dto.password, PASSWORD_SALT_ROUNDS);

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
            },

            select: {
                id: true,
                email: true,
                createdAt: true,
            },
        });

        return {
            user,
        };
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: {
                email: dto.email,
            },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid email or password.');
        }

        const isPasswordValid = await compare(dto.password, user.passwordHash);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password.');
        }

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
        };

        const accessToken = await this.jwtService.signAsync(payload);

        return {
            accessToken,

            user: {
                id: user.id,
                email: user.email,
                createdAt: user.createdAt,
            },
        };
    }
}
