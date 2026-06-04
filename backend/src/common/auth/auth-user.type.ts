import { UserRole } from '../../database/entities';

export interface AuthUser {
  sub: string;
  keycloakId: string;
  email?: string;
  fullName?: string;
  roles: UserRole[];
  rawRoles: string[];
  tokenExpiresAt?: number;
  tenantId?: string;
}

