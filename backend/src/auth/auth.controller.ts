import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { getAuthCookieOptions } from './auth-cookie-options';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() dto: LoginDto,

        @Res({ passthrough: true })
        response: Response,
    ) {
        const result = await this.authService.login(dto);

        response.cookie(
            AUTH_COOKIE_NAME,
            result.accessToken,
            getAuthCookieOptions(this.configService, true),
        );

        return {
            user: result.user,
        };
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
        return {
            user,
        };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    logout(
        @Res({ passthrough: true })
        response: Response,
    ) {
        response.clearCookie(
            AUTH_COOKIE_NAME,
            getAuthCookieOptions(this.configService, false),
        );

        return {
            success: true,
        };
    }
}
