import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredToken, getStoredUser, saveAuthSession, clearAuthSession } from '../api/client';
import { User } from '../types/auth';

describe('API Client Auth Storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const mockUser: User = {
    id: 'usr_elena_morales',
    username: 'elena.morales',
    email: 'elena.morales@bia.app',
    name: 'Ing. Elena Morales',
    role: 'Analista Senior',
    plant: 'Planta Norte',
    initials: 'EM',
  };

  it('saves session to localStorage when remember is true', () => {
    saveAuthSession('token_123', mockUser, true);

    expect(getStoredToken()).toBe('token_123');
    expect(getStoredUser()).toEqual(mockUser);
    expect(localStorage.getItem('bia_auth_token')).toBe('token_123');
  });

  it('saves session to sessionStorage when remember is false', () => {
    saveAuthSession('token_session_456', mockUser, false);

    expect(getStoredToken()).toBe('token_session_456');
    expect(getStoredUser()).toEqual(mockUser);
    expect(sessionStorage.getItem('bia_auth_token')).toBe('token_session_456');
    expect(localStorage.getItem('bia_auth_token')).toBeNull();
  });

  it('clears auth session from both storages', () => {
    saveAuthSession('token_123', mockUser, true);
    clearAuthSession();

    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});
