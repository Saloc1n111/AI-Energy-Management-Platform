export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  plant: string;
  initials: string;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: User;
}
