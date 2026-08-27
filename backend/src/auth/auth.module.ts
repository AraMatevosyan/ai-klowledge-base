import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
    imports: [
        PrismaModule,

        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],

            useFactory: (configService: ConfigService) => ({
                secret: configService.getOrThrow<string>('JWT_SECRET'),

                signOptions: {
                    expiresIn: configService.getOrThrow<number>(
                        'JWT_EXPIRES_IN_SECONDS',
                    ),
                },
            }),
        }),
    ],

    controllers: [AuthController],

    providers: [AuthService, JwtAuthGuard],

    exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
