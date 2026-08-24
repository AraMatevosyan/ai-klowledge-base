import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { AuthenticatedUser, JwtPayload } from './auth.types';

type AuthenticatedRequest = Request & {
    user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();

        const token = this.extractTokenFromCookie(request);

        if (!token) {
            throw new UnauthorizedException('Authentication is required.');
        }

        try {
            const payload =
                await this.jwtService.verifyAsync<JwtPayload>(token);

            if (!payload.sub || !payload.email) {
                throw new UnauthorizedException();
            }

            request.user = {
                id: payload.sub,
                email: payload.email,
            };

            return true;
        } catch {
            throw new UnauthorizedException(
                'Your session is invalid or has expired.',
            );
        }
    }

    private extractTokenFromCookie(request: Request): string | undefined {
        const token = request.cookies?.[AUTH_COOKIE_NAME] as unknown;

        return typeof token === 'string' ? token : undefined;
    }
}
