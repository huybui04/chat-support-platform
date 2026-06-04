import { BadRequestException, Injectable } from '@nestjs/common';

import { UserRole } from '../../database/entities';

type KeycloakTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type KeycloakUser = {
  id: string;
  username: string;
};

@Injectable()
export class KeycloakAdminService {
  async createUser(
    input: {
      username: string;
      email: string;
      fullName: string;
      role: UserRole;
      password: string;
      requirePasswordChange: boolean;
      firstName?: string;
      lastName?: string;
    },
    customRealm?: string,
  ): Promise<string> {
    const token = await this.getAdminAccessToken(customRealm);
    const { baseUrl, realm } = this.getIssuerConfig();
    const targetRealm = customRealm || realm;
    const adminRealm = this.getAdminRealm(targetRealm);
    const adminBaseUrl = `${baseUrl}/admin/realms/${adminRealm}`;

    const response = await fetch(`${adminBaseUrl}/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        enabled: true,
        firstName: input.firstName,
        lastName: input.lastName,
        credentials: [
          {
            type: 'password',
            value: input.password,
            temporary: input.requirePasswordChange,
          },
        ],
      }),
    });

    if (response.status === 409) {
      throw new BadRequestException('Keycloak user already exists');
    }

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(text || 'Keycloak user creation failed');
    }

    const location = response.headers.get('location');
    let userId: string | undefined = location?.split('/').pop();

    if (!userId) {
      userId = await this.findUserIdByUsername(token, adminBaseUrl, input.username);
    }

    if (!userId) {
      throw new BadRequestException('Keycloak user id not found after creation');
    }

    await this.assignRealmRole(token, adminBaseUrl, userId, input.role);
    return userId;
  }

  async deleteUser(userId: string, customRealm?: string): Promise<void> {
    const token = await this.getAdminAccessToken(customRealm);
    const { baseUrl, realm } = this.getIssuerConfig();
    const targetRealm = customRealm || realm;
    const adminRealm = this.getAdminRealm(targetRealm);
    const adminBaseUrl = `${baseUrl}/admin/realms/${adminRealm}`;

    await fetch(`${adminBaseUrl}/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  private async assignRealmRole(
    token: string,
    adminBaseUrl: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const roleName = this.resolveRealmRole(role);
    const roleResponse = await fetch(
      `${adminBaseUrl}/roles/${encodeURIComponent(roleName)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!roleResponse.ok) {
      const text = await roleResponse.text();
      throw new BadRequestException(text || 'Keycloak role lookup failed');
    }

    const rolePayload = await roleResponse.json();

    const assignResponse = await fetch(
      `${adminBaseUrl}/users/${userId}/role-mappings/realm`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([rolePayload]),
      },
    );

    if (!assignResponse.ok) {
      const text = await assignResponse.text();
      throw new BadRequestException(text || 'Keycloak role assignment failed');
    }
  }

  private async findUserIdByUsername(
    token: string,
    adminBaseUrl: string,
    username: string,
  ): Promise<string | undefined> {
    const response = await fetch(
      `${adminBaseUrl}/users?username=${encodeURIComponent(username)}&exact=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      return undefined;
    }

    const users = (await response.json()) as KeycloakUser[];
    return users[0]?.id;
  }

  private async getAdminAccessToken(customRealm?: string): Promise<string> {
    const { baseUrl, realm } = this.getIssuerConfig();
    const targetRealm = customRealm || realm;
    const adminRealm = this.getAdminRealm(targetRealm);
    const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID?.trim();

    if (!clientId) {
      throw new BadRequestException('Missing KEYCLOAK_ADMIN_CLIENT_ID');
    }

    const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET?.trim();

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
    });

    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const response = await fetch(
      `${baseUrl}/realms/${adminRealm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    const data = (await response.json()) as KeycloakTokenResponse;

    if (!response.ok || !data.access_token) {
      throw new BadRequestException(
        data.error_description || data.error || 'Keycloak admin token failed',
      );
    }

    return data.access_token;
  }

  private getIssuerConfig(): { baseUrl: string; realm: string } {
    const issuer = process.env.KEYCLOAK_ISSUER?.trim();
    if (!issuer) {
      throw new BadRequestException('Missing KEYCLOAK_ISSUER configuration.');
    }

    const url = new URL(issuer);
    const path = url.pathname.replace(/\/$/, '');
    const match = path.match(/\/realms\/([^/]+)$/);

    if (!match) {
      throw new BadRequestException('Invalid KEYCLOAK_ISSUER configuration.');
    }

    return {
      baseUrl: `${url.protocol}//${url.host}`,
      realm: match[1],
    };
  }

  private getAdminRealm(defaultRealm: string): string {
    const realm = process.env.KEYCLOAK_ADMIN_REALM?.trim();
    return realm || defaultRealm;
  }

  private resolveRealmRole(role: UserRole): string {
    if (role === UserRole.SUPERVISOR) {
      return 'supervisor';
    }

    return 'agent';
  }
}
