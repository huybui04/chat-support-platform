import { Body, Controller, Get, Post } from '@nestjs/common';

import type { AuthUser } from '../../common/auth/auth-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthLogoutDto } from './dto/auth-logout.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() payload: AuthLoginDto) {
    const tokens = await this.authService.login(payload);
    return apiSuccess(tokens);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() payload: AuthRefreshDto) {
    const tokens = await this.authService.refresh(payload);
    return apiSuccess(tokens);
  }

  @Public()
  @Post('logout')
  async logout(@Body() payload: AuthLogoutDto) {
    await this.authService.logout(payload);
    return apiSuccess({ loggedOut: true });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return apiSuccess(user);
  }
}
