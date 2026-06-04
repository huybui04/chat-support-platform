import { UserRole } from '../../database/entities';
import { AuthUser } from './auth-user.type';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

interface JwtPayload {
  iss?: string;
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  azp?: string;
  exp?: number;
  realm_access?: unknown;
  resource_access?: unknown;
}

let cachedJwksUri = '';
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function parseBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token.trim();
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const payloadText = Buffer.from(segments[1], 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadText) as unknown;
    if (!isRecord(payload)) {
      return null;
    }
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function extractRawRoles(payload: JwtPayload): string[] {
  const realmRoles = isRecord(payload.realm_access)
    ? asStringArray(payload.realm_access.roles)
    : [];

  const resourceRoles: string[] = [];
  if (isRecord(payload.resource_access)) {
    for (const value of Object.values(payload.resource_access)) {
      if (isRecord(value)) {
        resourceRoles.push(...asStringArray(value.roles));
      }
    }
  }

  return [
    ...new Set([...realmRoles, ...resourceRoles].map((role) => role.trim())),
  ];
}

export function mapRoles(rawRoles: string[]): UserRole[] {
  const normalized = rawRoles.map((role) => role.toLowerCase());
  const roles = new Set<UserRole>();

  if (
    normalized.includes(UserRole.SUPERVISOR) ||
    normalized.includes('admin')
  ) {
    roles.add(UserRole.SUPERVISOR);
  }

  if (normalized.includes(UserRole.AGENT)) {
    roles.add(UserRole.AGENT);
  }

  return [...roles];
}

export function buildAuthUser(token: string): AuthUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== 'string') {
    return null;
  }

  return buildAuthUserFromPayload(payload);
}

function buildAuthUserFromPayload(payload: JwtPayload): AuthUser | null {
  if (typeof payload.sub !== 'string') {
    return null;
  }

  let tenantId = 'chat-support-platform';
  if (payload.iss) {
    const match = payload.iss.match(/\/realms\/([^/]+)$/);
    if (match) {
      tenantId = match[1];
    }
  }

  const rawRoles = extractRawRoles(payload);
  return {
    sub: payload.sub,
    keycloakId: payload.sub,
    email: payload.email,
    fullName: payload.name ?? payload.preferred_username,
    roles: mapRoles(rawRoles),
    rawRoles,
    tokenExpiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
    tenantId,
  };
}

function toJwtPayload(payload: JWTPayload): JwtPayload {
  return {
    iss: typeof payload.iss === 'string' ? payload.iss : undefined,
    sub: typeof payload.sub === 'string' ? payload.sub : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    preferred_username:
      typeof payload.preferred_username === 'string'
        ? payload.preferred_username
        : undefined,
    azp: typeof payload.azp === 'string' ? payload.azp : undefined,
    exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    realm_access: payload.realm_access,
    resource_access: payload.resource_access,
  };
}

function parseAudienceConfig(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function isAudienceValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'JWTClaimValidationFailed' &&
    error.message.toLowerCase().includes('aud')
  );
}

function getKeycloakJwks(issuerFromToken?: string) {
  const defaultIssuer = process.env.KEYCLOAK_ISSUER?.trim();
  if (!defaultIssuer) {
    return null;
  }

  let issuer = defaultIssuer;
  if (issuerFromToken) {
    const realmsIndex = defaultIssuer.indexOf('/realms/');
    const defaultBase = realmsIndex !== -1 ? defaultIssuer.substring(0, realmsIndex) : defaultIssuer;
    const tokenRealmsIndex = issuerFromToken.indexOf('/realms/');
    const tokenBase = tokenRealmsIndex !== -1 ? issuerFromToken.substring(0, tokenRealmsIndex) : '';

    if (tokenBase && defaultBase.replace(/\/$/, '') === tokenBase.replace(/\/$/, '')) {
      issuer = issuerFromToken;
    }
  }

  const jwksUri = `${issuer}/protocol/openid-connect/certs`;

  if (!cachedJwks || cachedJwksUri !== jwksUri) {
    cachedJwksUri = jwksUri;
    cachedJwks = createRemoteJWKSet(new URL(jwksUri));
  }

  return {
    issuer,
    audiences: parseAudienceConfig(process.env.KEYCLOAK_AUDIENCE),
    clientId: process.env.KEYCLOAK_CLIENT_ID?.trim(),
    jwks: cachedJwks,
  };
}

export async function verifyAndBuildAuthUser(
  token: string,
): Promise<AuthUser | null> {
  const payload = decodeJwtPayload(token);
  const issuerFromToken = payload?.iss;

  const keycloak = getKeycloakJwks(issuerFromToken);

  // Keep local decoding fallback for environments where Keycloak is not configured.
  if (!keycloak) {
    return buildAuthUser(token);
  }

  const verifyOptions = keycloak.audiences.length
    ? { issuer: keycloak.issuer, audience: keycloak.audiences }
    : { issuer: keycloak.issuer };

  try {
    const { payload: verifiedPayload } = await jwtVerify(token, keycloak.jwks, verifyOptions);
    return buildAuthUserFromPayload(toJwtPayload(verifiedPayload));
  } catch (error) {
    // Some Keycloak setups put the frontend client in `azp` while `aud` is `account`.
    if (
      !keycloak.audiences.length ||
      !keycloak.clientId ||
      !isAudienceValidationError(error)
    ) {
      throw error;
    }

    const { payload: verifiedPayload } = await jwtVerify(token, keycloak.jwks, {
      issuer: keycloak.issuer,
    });

    if (verifiedPayload.azp !== keycloak.clientId) {
      throw error;
    }

    return buildAuthUserFromPayload(toJwtPayload(verifiedPayload));
  }
}
