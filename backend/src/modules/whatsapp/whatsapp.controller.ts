import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { WhatsappInboundMessageDto } from './dto/whatsapp-inbound-message.dto';
import { WhatsappService } from './whatsapp.service';

type QueryValue = string | string[] | undefined;

function firstString(value: QueryValue): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
}

function pickQueryString(
  query: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = firstString(query[key] as QueryValue);
    if (value) {
      return value;
    }
  }

  return undefined;
}

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('webhook')
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verifyWebhook(@Query() query: Record<string, unknown>) {
    const hub =
      query.hub && typeof query.hub === 'object'
        ? (query.hub as Record<string, unknown>)
        : undefined;

    const normalizedQuery = {
      mode:
        pickQueryString(query, ['mode', 'hub.mode', 'hub_mode']) ??
        pickQueryString(hub ?? {}, ['mode']),
      challenge:
        pickQueryString(query, [
          'challenge',
          'hub.challenge',
          'hub_challenge',
        ]) ?? pickQueryString(hub ?? {}, ['challenge']),
      verifyToken:
        pickQueryString(query, [
          'verifyToken',
          'verify_token',
          'hub.verify_token',
          'hub_verify_token',
        ]) ?? pickQueryString(hub ?? {}, ['verify_token']),
    };

    const result = this.whatsappService.verifyWebhook(normalizedQuery);
    return result.challenge;
  }

  @Post('webhook')
  @Public()
  async receiveInboundMessage(
    @Req() request: Request,
    @Body() payload: WhatsappInboundMessageDto,
  ) {
    this.whatsappService.verifyWebhookSignature(request, payload);
    const result = await this.whatsappService.handleInboundMessage(payload);
    return apiSuccess(result);
  }
}
