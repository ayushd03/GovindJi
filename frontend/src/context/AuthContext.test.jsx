import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';

const mockLoginRequest = jest.fn();
let consoleErrorSpy;

jest.mock('../services/api', () => ({
  authAPI: {
    login: (...args) => mockLoginRequest(...args),
    signup: jest.fn(),
    getProfile: jest.fn(),
    refreshToken: jest.fn(),
    validateToken: jest.fn(),
  },
}));

const LoginProbe = () => {
  const { login } = useAuth();
  const [message, setMessage] = useState('');

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const result = await login('customer@example.com', 'WrongPassword');
          setMessage(result.error || '');
        }}
      >
        Trigger Login
      </button>
      {message && <p>{message}</p>}
    </div>
  );
};

describe('AuthContext login errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('returns a readable credentials message for 401 login failures without an error body', async () => {
    mockLoginRequest.mockRejectedValueOnce({
      message: 'Request failed with status code 401',
      response: {
        status: 401,
        data: {},
      },
    });

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: /trigger login/i }));

    await waitFor(() => {
      expect(screen.getByText('Incorrect email or password')).toBeInTheDocument();
    });
  });
});
