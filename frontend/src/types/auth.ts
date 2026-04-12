export type UserRole = "supervisor" | "agent";

export type AuthState = {
  token: string;
  refreshToken: string;
  idToken: string;
  role: UserRole | null;
};
