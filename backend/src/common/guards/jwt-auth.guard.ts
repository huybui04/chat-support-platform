import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import type { AuthUser } from '../auth/auth-user.type';
import { parseBearerToken, verifyAndBuildAuthUser } from '../auth/jwt.util';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (context.getType<'http' | 'ws'>() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = parseBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let user: AuthUser | null = null;
    try {
      user = await verifyAndBuildAuthUser(token);
    } catch {
      // Log underlying verification error for debugging
      try {
        // attempt to get more info by re-running to capture error
        await verifyAndBuildAuthUser(token);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          'JWT verification failed:',
          err instanceof Error ? err.message : err,
        );
      }
      throw new UnauthorizedException('Invalid token signature');
    }

    if (!user) {
      throw new UnauthorizedException('Invalid token payload');
    }

    request.user = user;
    return true;
  }
}
