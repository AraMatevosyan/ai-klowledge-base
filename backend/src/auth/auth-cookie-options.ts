import {
    ConfigService,
} from '@nestjs/config';
import type {
    CookieOptions,
} from 'express';
import {
    DEFAULT_AUTH_TOKEN_TTL_SECONDS,
} from './auth.constants';

type AuthCookieSameSite =
    | 'lax'
    | 'strict'
    | 'none';

export function getAuthCookieOptions(
    configService: ConfigService,
    includeMaxAge: boolean,
): CookieOptions {
    const nodeEnvironment =
        configService.get<string>(
            'NODE_ENV',
            'development',
        );

    const sameSite =
        configService.get<AuthCookieSameSite>(
            'AUTH_COOKIE_SAME_SITE',
            'lax',
        );

    const baseOptions:
        CookieOptions = {
        httpOnly: true,

        secure:
            nodeEnvironment ===
            'production' ||
            sameSite === 'none',

        sameSite,

        path: '/',
    };

    if (!includeMaxAge) {
        return baseOptions;
    }

    const expiresInSeconds =
        Number(
            configService.get(
                'JWT_EXPIRES_IN_SECONDS',
                DEFAULT_AUTH_TOKEN_TTL_SECONDS,
            ),
        );

    return {
        ...baseOptions,

        maxAge:
            expiresInSeconds *
            1000,
    };
}
