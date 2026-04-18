import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { ExternalChannel } from '../../database/entities';
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

function parseExternalChannel(channel: string): ExternalChannel {
  const normalized = channel.trim().toLowerCase();

  if (
    normalized !== ExternalChannel.WHATSAPP &&
    normalized !== ExternalChannel.INSTAGRAM &&
    normalized !== ExternalChannel.MESSENGER
  ) {
    throw new BadRequestException('Unsupported channel');
  }

  return normalized as ExternalChannel;
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

    const result = this.whatsappService.verifyWebhook(
      normalizedQuery,
      ExternalChannel.WHATSAPP,
    );
    return result.challenge;
  }

  @Get(':channel/webhook')
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verifyWebhookByChannel(
    @Param('channel') channel: string,
    @Query() query: Record<string, unknown>,
  ) {
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

    const parsedChannel = parseExternalChannel(channel);
    const result = this.whatsappService.verifyWebhook(
      normalizedQuery,
      parsedChannel,
    );

    return result.challenge;
  }

  @Post('webhook')
  @Public()
  async receiveInboundMessage(
    @Req() request: Request,
    @Body() payload: WhatsappInboundMessageDto,
  ) {
    this.whatsappService.verifyWebhookSignature(
      request,
      payload,
      ExternalChannel.WHATSAPP,
    );
    const result = await this.whatsappService.handleInboundMessageByChannel(
      ExternalChannel.WHATSAPP,
      payload,
    );
    return apiSuccess(result);
  }

  @Post(':channel/webhook')
  @Public()
  async receiveInboundMessageByChannel(
    @Param('channel') channel: string,
    @Req() request: Request,
    @Body() payload: Record<string, unknown>,
  ) {
    const parsedChannel = parseExternalChannel(channel);
    this.whatsappService.verifyWebhookSignature(request, payload, parsedChannel);
    const result = await this.whatsappService.handleInboundMessageByChannel(
      parsedChannel,
      payload,
    );
    return apiSuccess(result);
  }
}
