import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Redirect,
} from '@nestjs/common';

import type { AuthUser } from '../../common/auth/auth-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import { GmailService } from './gmail.service';

@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @Get('oauth/authorize')
  @Public()
  @Redirect()
  authorize(
    @Query('tenantId') tenantId?: string,
    @Query('returnUrl') returnUrl?: string,
  ) {
    const url = this.gmailService.buildOAuthAuthorizeUrl(tenantId || 'chat-support-platform', returnUrl);
    return { url };
  }

  @Get('oauth/callback')
  @Public()
  @Redirect()
  async callback(@Query('code') code?: string, @Query('state') state?: string) {
    if (!code) {
      throw new BadRequestException('Missing OAuth code');
    }

    const redirectUrl = await this.gmailService.handleOAuthCallback(
      code,
      state,
    );
    return { url: redirectUrl };
  }

  @Get('accounts')
  @Roles(UserRole.SUPERVISOR)
  async listAccounts(@CurrentUser() user: AuthUser) {
    const accounts = await this.gmailService.listAccounts(user.tenantId || 'chat-support-platform');
    return apiSuccess(accounts);
  }

  @Post('webhook')
  @Public()
  @HttpCode(200)
  async handleWebhook(@Body() payload: Record<string, unknown>) {
    const result = await this.gmailService.handlePubSubPush(payload);
    return apiSuccess(result);
  }
}

