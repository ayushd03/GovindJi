import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthFlow from './AuthFlow';
import { clearRecoverySession, readRecoverySession } from '../../utils/authRecovery';

const mockApplySession = jest.fn();
const mockLogin = jest.fn();
const mockSignup = jest.fn();
const mockNavigate = jest.fn();
const mockToast = jest.fn();
const mockForgotPassword = jest.fn();
const mockResendConfirmation = jest.fn();
const mockExchangeLinkSession = jest.fn();
const mockRefreshToken = jest.fn();
const mockUpdatePassword = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: mockSignup,
    applySession: mockApplySession,
  }),
}));

jest.mock('../../hooks/useToast', () => ({
  toast: (...args) => mockToast(...args),
}));

jest.mock('../../services/api', () => ({
  authAPI: {
    forgotPassword: (...args) => mockForgotPassword(...args),
    resendConfirmation: (...args) => mockResendConfirmation(...args),
    exchangeLinkSession: (...args) => mockExchangeLinkSession(...args),
    refreshToken: (...args) => mockRefreshToken(...args),
    updatePassword: (...args) => mockUpdatePassword(...args),
  },
}));

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AuthFlow password recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    clearRecoverySession();
  });

  it('reuses the stored recovery session after a failed password update attempt', async () => {
    mockUpdatePassword
      .mockRejectedValueOnce({
        response: {
          data: {
            error: 'Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          message: 'Password updated successfully',
        },
      });

    render(
      <MemoryRouter initialEntries={['/auth?mode=reset-password&type=recovery#access_token=recovery-access&refresh_token=recovery-refresh&expires_in=3600']}>
        <AuthFlow variant="page" mode="reset-password" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(readRecoverySession()?.session?.access_token).toBe('recovery-access');
    });

    expect(localStorage.getItem('authToken')).toBeNull();
    expect(mockApplySession).not.toHaveBeenCalled();

    const passwordInput = screen.getByLabelText(/^Password$/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm Password/i);
    const submitButton = screen.getByRole('button', { name: /Update Password/i });

    await userEvent.type(passwordInput, 'ValidPass@123');
    await userEvent.type(confirmPasswordInput, 'ValidPass@123');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenNthCalledWith(1, 'ValidPass@123', {
        accessToken: 'recovery-access',
        refreshToken: 'recovery-refresh',
      });
    });

    expect(readRecoverySession()?.session?.access_token).toBe('recovery-access');

    await userEvent.clear(passwordInput);
    await userEvent.clear(confirmPasswordInput);
    await userEvent.type(passwordInput, 'StrongerPass@456');
    await userEvent.type(confirmPasswordInput, 'StrongerPass@456');
    await userEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenNthCalledWith(2, 'StrongerPass@456', {
        accessToken: 'recovery-access',
        refreshToken: 'recovery-refresh',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Your password is updated/i)).toBeInTheDocument();
    });

    expect(readRecoverySession()).toBeNull();
    expect(mockApplySession).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'recovery-access' }),
      null
    );
  });
});
