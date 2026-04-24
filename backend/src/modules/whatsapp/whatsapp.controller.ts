import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
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

function isUnsupportedInboundEvent(error: unknown): boolean {
  if (!(error instanceof BadRequestException)) {
    return false;
  }

  const response = error.getResponse();
  if (typeof response === 'string') {
    return response.includes('No supported inbound');
  }

  if (response && typeof response === 'object') {
    const message = (response as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message.includes('No supported inbound');
    }

    if (Array.isArray(message)) {
      return message.some(
        (item) =>
          typeof item === 'string' && item.includes('No supported inbound'),
      );
    }
  }

  return false;
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
  @HttpCode(200)
  @Public()
  async receiveInboundMessage(
    @Req() request: Request,
    @Body() payload: WhatsappInboundMessageDto,
  ) {
    try {
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
    } catch (error) {
      if (isUnsupportedInboundEvent(error)) {
        return apiSuccess({ ignored: true, reason: 'unsupported_event' });
      }

      throw error;
    }
  }

  @Post(':channel/webhook')
  @HttpCode(200)
  @Public()
  async receiveInboundMessageByChannel(
    @Param('channel') channel: string,
    @Req() request: Request,
    @Body() payload: Record<string, unknown>,
  ) {
    const parsedChannel = parseExternalChannel(channel);
    try {
      this.whatsappService.verifyWebhookSignature(
        request,
        payload,
        parsedChannel,
      );
      const result = await this.whatsappService.handleInboundMessageByChannel(
        parsedChannel,
        payload,
      );
      return apiSuccess(result);
    } catch (error) {
      if (isUnsupportedInboundEvent(error)) {
        return apiSuccess({ ignored: true, reason: 'unsupported_event' });
      }

      throw error;
    }
  }
}

@Controller()
export class MetaWebhookAliasController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('messenger/webhook')
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verifyMessengerWebhook(@Query() query: Record<string, unknown>) {
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
      ExternalChannel.MESSENGER,
    );
    return result.challenge;
  }

  @Post('messenger/webhook')
  @HttpCode(200)
  @Public()
  async receiveMessengerInboundMessage(
    @Req() request: Request,
    @Body() payload: Record<string, unknown>,
  ) {
    try {
      this.whatsappService.verifyWebhookSignature(
        request,
        payload,
        ExternalChannel.MESSENGER,
      );
      const result = await this.whatsappService.handleInboundMessageByChannel(
        ExternalChannel.MESSENGER,
        payload,
      );
      return apiSuccess(result);
    } catch (error) {
      if (isUnsupportedInboundEvent(error)) {
        return apiSuccess({ ignored: true, reason: 'unsupported_event' });
      }

      throw error;
    }
  }

  @Get('instagram/webhook')
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verifyInstagramWebhook(@Query() query: Record<string, unknown>) {
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
      ExternalChannel.INSTAGRAM,
    );
    return result.challenge;
  }

  @Post('instagram/webhook')
  @HttpCode(200)
  @Public()
  async receiveInstagramInboundMessage(
    @Req() request: Request,
    @Body() payload: Record<string, unknown>,
  ) {
    try {
      this.whatsappService.verifyWebhookSignature(
        request,
        payload,
        ExternalChannel.INSTAGRAM,
      );
      const result = await this.whatsappService.handleInboundMessageByChannel(
        ExternalChannel.INSTAGRAM,
        payload,
      );
      return apiSuccess(result);
    } catch (error) {
      if (isUnsupportedInboundEvent(error)) {
        return apiSuccess({ ignored: true, reason: 'unsupported_event' });
      }

      throw error;
    }
  }
}
