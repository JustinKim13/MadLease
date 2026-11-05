import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// apiService.js imports `auth` from ../config/firebase, which in turn calls
// firebase's initializeApp()/getAuth() against real (missing, in a test env)
// Firebase config. Mock the module so we control `auth.currentUser` directly
// without touching real Firebase.
vi.mock('../config/firebase', () => ({
  auth: { currentUser: null },
}));

import { auth } from '../config/firebase';
import { ApiService, API_BASE_URL } from './apiService';

describe('ApiService', () => {
  beforeEach(() => {
    auth.currentUser = null;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an authenticated GET when there is no signed-in Firebase user', async () => {
    await expect(ApiService.get('/listings/123')).rejects.toThrow('User not authenticated');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('issues a public GET without an Authorization header and returns parsed JSON', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, title: 'Cozy 2BR near campus' }),
    });

    const result = await ApiService.get('/listings/1', false);

    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/listings/1`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual({ id: 1, title: 'Cozy 2BR near campus' });
  });

  it('attaches a Bearer token from the current Firebase user on an authenticated GET', async () => {
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('fake-jwt-token') };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    await ApiService.get('/listings/mine');

    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/listings/mine`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-jwt-token',
        'Content-Type': 'application/json',
      },
    });
  });

  it('rejects a failed POST with a generic HTTP error message', async () => {
    // NOTE: `post()`'s current implementation throws the parsed backend
    // error (`errorData.error`) *inside* the same try block that catches
    // it, so that throw is immediately swallowed by its own `catch` and
    // replaced with the generic `HTTP error! status: ${status}` message
    // below — the backend's actual error text never reaches the caller.
    // This test documents real (buggy) current behavior; see apiService.js
    // post()'s catch block if this is ever fixed.
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('fake-jwt-token') };
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Rent must be a positive integer' }),
    });

    await expect(ApiService.post('/listings', { rent: -5 })).rejects.toThrow(
      'HTTP error! status: 400'
    );
  });
});
