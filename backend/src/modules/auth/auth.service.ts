import { BadRequestException, Injectable } from '@nestjs/common';

import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthLogoutDto } from './dto/auth-logout.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';

type KeycloakTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  tokenType: string;
  expiresIn: number;
};

@Injectable()
export class AuthService {
  async login(payload: AuthLoginDto): Promise<AuthTokens> {
    return this.requestToken({
      grant_type: 'authorization_code',
      code: payload.code,
      redirect_uri: payload.redirectUri,
      code_verifier: payload.codeVerifier,
    });
  }

  async refresh(payload: AuthRefreshDto): Promise<AuthTokens> {
    return this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: payload.refreshToken,
    });
  }

  async logout(payload: AuthLogoutDto): Promise<void> {
    const clientId = this.getClientId();
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET?.trim();
    const endpoint = this.getLogoutEndpoint();

    const body = new URLSearchParams({ client_id: clientId });
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }
    if (payload.refreshToken) {
      body.set('refresh_token', payload.refreshToken);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(text || 'Keycloak logout failed.');
    }
  }

  private async requestToken(
    params: Record<string, string>,
  ): Promise<AuthTokens> {
    const clientId = this.getClientId();
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET?.trim();
    const endpoint = this.getTokenEndpoint();

    const body = new URLSearchParams({
      client_id: clientId,
      ...params,
    });

    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = (await response.json()) as KeycloakTokenResponse;
    if (!response.ok || !data.access_token) {
      throw new BadRequestException(
        data.error_description ||
          data.error ||
          'Keycloak token request failed.',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? '',
      idToken: data.id_token ?? '',
      tokenType: data.token_type ?? 'Bearer',
      expiresIn: data.expires_in ?? 0,
    };
  }

  private getIssuer(): string {
    const issuer = process.env.KEYCLOAK_ISSUER?.trim();
    if (!issuer) {
      throw new BadRequestException('Missing KEYCLOAK_ISSUER configuration.');
    }

    return issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;
  }

  private getClientId(): string {
    const clientId = process.env.KEYCLOAK_CLIENT_ID?.trim();
    if (!clientId) {
      throw new BadRequestException(
        'Missing KEYCLOAK_CLIENT_ID configuration.',
      );
    }

    return clientId;
  }

  private getTokenEndpoint(): string {
    return `${this.getIssuer()}/protocol/openid-connect/token`;
  }

  private getLogoutEndpoint(): string {
    return `${this.getIssuer()}/protocol/openid-connect/logout`;
  }
}
