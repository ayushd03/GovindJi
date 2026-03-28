import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../hooks/useToast';
import { authAPI } from '../../services/api';
import {
  clearPendingAuthJourney,
  getPostAuthDestination,
  normalizeAuthMode,
  persistPendingAuthJourney,
  readPendingAuthJourney,
} from '../../utils/authRouting';
import {
  clearRecoverySession,
  isRecoverySessionExpired,
  persistRecoverySession,
  readRecoverySession,
  resolveAuthCallbackIntent,
  shouldRefreshRecoverySession,
} from '../../utils/authRecovery';
import {
  getPasswordValidationMessage,
  isValidEmail,
  PASSWORD_POLICY_HINT,
} from '../../utils/authValidation';

const modeContent = {
  'sign-in': {
    eyebrow: 'Welcome back',
    title: 'Sign in to continue',
    description: 'Use your account to continue shopping, checkout faster, and track your orders.',
    submitLabel: 'Sign In',
  },
  'sign-up': {
    eyebrow: 'Create account',
    title: 'Join GovindJi Dry Fruits',
    description: 'Create your account once, then use the same flow for orders, checkout, and recovery.',
    submitLabel: 'Create Account',
  },
  'forgot-password': {
    eyebrow: 'Password recovery',
    title: 'Reset your password',
    description: 'Enter your email and we will send you a secure password reset link.',
    submitLabel: 'Send Reset Link',
  },
  'reset-password': {
    eyebrow: 'Choose new password',
    title: 'Set a new password',
    description: 'Your recovery link is verified. Create a new password for your account.',
    submitLabel: 'Update Password',
  },
  'check-email': {
    eyebrow: 'Check your inbox',
    title: 'Email sent',
    description: 'Use the link in your inbox to continue.',
    submitLabel: 'Continue',
  },
  confirmed: {
    eyebrow: 'Account ready',
    title: 'You are signed in',
    description: 'Your account is now connected to the storefront and ready to use.',
    submitLabel: 'Continue',
  },
};

const cleanAuthUrl = () => {
  const url = new URL(window.location.href);
  url.hash = '';
  [
    'access_token',
    'code',
    'refresh_token',
    'expires_in',
    'expires_at',
    'token_hash',
    'token_type',
    'type',
    'error',
    'error_code',
    'error_description',
  ].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
};

const AuthFlow = ({
  variant = 'page',
  mode: modeProp = 'sign-in',
  nextPath = '',
  reason = '',
  email = '',
  onModeChange,
  onAuthenticated,
  onRequestClose,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, applySession } = useAuth();
  const callbackHandledRef = useRef(false);

  const initialMode = normalizeAuthMode(modeProp);
  const pendingJourney = useMemo(() => readPendingAuthJourney(), []);
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    name: '',
    email: email || pendingJourney?.email || '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingLink, setIsProcessingLink] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(email || pendingJourney?.email || '');
  const [pendingIntent, setPendingIntent] = useState(pendingJourney?.intent || 'signup');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const isPageVariant = variant === 'page';
  const copy = modeContent[mode] || modeContent['sign-in'];

  const updateMode = useCallback((nextMode, options = {}) => {
    const normalizedMode = normalizeAuthMode(nextMode);
    setMode(normalizedMode);
    setErrors({});

    if (options.email) {
      setFormData((current) => ({ ...current, email: options.email }));
      setPendingEmail(options.email);
    }

    if (options.intent) {
      setPendingIntent(options.intent);
    }

    if (options.message !== undefined) {
      setFeedbackMessage(options.message);
    }

    onModeChange?.(normalizedMode, options);
  }, [onModeChange]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (email) {
      setFormData((current) => ({ ...current, email }));
      setPendingEmail(email);
    }
  }, [email]);

  useEffect(() => {
    if (mode !== 'reset-password') {
      return;
    }

    const storedRecovery = readRecoverySession();
    if (!storedRecovery?.email) {
      return;
    }

    setPendingIntent('recovery');
    setPendingEmail((current) => current || storedRecovery.email);
    setFormData((current) => (
      current.email ? current : { ...current, email: storedRecovery.email }
    ));
  }, [mode]);

  const resolveRecoverySession = useCallback(async () => {
    const storedRecovery = readRecoverySession();
    if (!storedRecovery?.session?.access_token) {
      return null;
    }

    if (shouldRefreshRecoverySession(storedRecovery)) {
      try {
        const refreshResponse = await authAPI.refreshToken(storedRecovery.session.refresh_token);
        const nextSession = refreshResponse.data?.session;
        const nextUser = refreshResponse.data?.user || storedRecovery.user || null;

        if (!nextSession?.access_token) {
          clearRecoverySession();
          return null;
        }

        return persistRecoverySession(nextSession, {
          user: nextUser,
          email: storedRecovery.email,
          intent: storedRecovery.intent || 'recovery',
        });
      } catch (error) {
        clearRecoverySession();
        throw error;
      }
    }

    if (isRecoverySessionExpired(storedRecovery)) {
      clearRecoverySession();
      return null;
    }

    return storedRecovery;
  }, []);

  useEffect(() => {
    if (!isPageVariant || callbackHandledRef.current) {
      return;
    }

    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(location.search);
    const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
    const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
    const code = hashParams.get('code') || queryParams.get('code');
    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
    const tokenHash = hashParams.get('token_hash') || queryParams.get('token_hash');
    const tokenType = hashParams.get('token_type') || queryParams.get('token_type') || 'bearer';
    const type = hashParams.get('type') || queryParams.get('type');
    const expiresIn = hashParams.get('expires_in') || queryParams.get('expires_in');
    const expiresAt = hashParams.get('expires_at') || queryParams.get('expires_at');
    const callbackIntent = resolveAuthCallbackIntent({
      type,
      mode: normalizeAuthMode(queryParams.get('mode') || modeProp),
      pendingIntent,
    });
    let shouldCleanLinkParams = false;

    if (errorDescription) {
      callbackHandledRef.current = true;
      const decodedMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      setErrors({ submit: decodedMessage });
      toast({
        title: 'Authentication link failed',
        description: decodedMessage,
        variant: 'destructive',
      });
      shouldCleanLinkParams = true;
      if (shouldCleanLinkParams) {
        cleanAuthUrl();
      }
      return;
    }

    if ((!accessToken || !refreshToken) && !code && !tokenHash) {
      return;
    }

    callbackHandledRef.current = true;
    setIsProcessingLink(true);

    const sessionFromUrl = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: tokenType,
      expires_in: expiresIn ? Number(expiresIn) : undefined,
      expires_at: expiresAt ? Number(expiresAt) : undefined,
    };

    (async () => {
      try {
        let resolvedSession = sessionFromUrl;
        let resolvedUser = null;

        if (!accessToken || !refreshToken) {
          const response = await authAPI.exchangeLinkSession({
            code: code || undefined,
            token_hash: tokenHash || undefined,
            type: type || undefined,
          });

          resolvedSession = response.data?.session;
          resolvedUser = response.data?.user || null;
        }

        if (!resolvedSession?.access_token || !resolvedSession?.refresh_token) {
          throw new Error('Missing session details from authentication link');
        }

        const storedJourney = readPendingAuthJourney();
        const callbackEmail = storedJourney?.email || formData.email || pendingEmail;
        shouldCleanLinkParams = true;

        if (callbackIntent === 'recovery') {
          persistRecoverySession(resolvedSession, {
            user: resolvedUser,
            email: callbackEmail,
            intent: 'recovery',
          });
          updateMode('reset-password', {
            email: callbackEmail,
            intent: 'recovery',
            message: 'Your recovery link is verified. Create a new password to finish signing in.',
          });
          toast({
            title: 'Reset link verified',
            description: 'Choose a new password to continue.',
          });
        } else {
          await applySession(resolvedSession, resolvedUser);
          clearRecoverySession();
          clearPendingAuthJourney();
          updateMode('confirmed', {
            email: callbackEmail,
            intent: 'signup',
            message: 'Your email has been confirmed and you are signed in.',
          });
          toast({
            title: 'Email confirmed',
            description: 'Your account is ready to use.',
            variant: 'success',
          });
        }
      } catch (error) {
        const message = error?.response?.data?.error || 'This authentication link is no longer valid. Please request a new one.';
        updateMode(callbackIntent === 'recovery' ? 'reset-password' : 'sign-in', {
          email: pendingEmail || formData.email,
          intent: callbackIntent,
        });
        setErrors({ submit: message });
        toast({
          title: 'Authentication link expired',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsProcessingLink(false);
        if (shouldCleanLinkParams) {
          cleanAuthUrl();
        }
      }
    })();
  }, [applySession, formData.email, isPageVariant, location.hash, location.search, modeProp, pendingEmail, pendingIntent, updateMode]);

  const navigateAfterAuth = useCallback(() => {
    const explicitNext = nextPath || pendingJourney?.next;
    const destination = getPostAuthDestination(explicitNext, '/');
    onAuthenticated?.({ destination, mode });

    if (isPageVariant) {
      navigate(destination, { replace: true });
      return;
    }

    if (explicitNext) {
      onRequestClose?.();
      navigate(destination, { replace: true });
      return;
    }

    if (onRequestClose) {
      onRequestClose();
    }
  }, [isPageVariant, mode, navigate, nextPath, onAuthenticated, onRequestClose, pendingJourney?.next]);

  const validateForm = () => {
    const nextErrors = {};

    if (mode === 'sign-in') {
      if (!isValidEmail(formData.email)) {
        nextErrors.email = 'Enter a valid email address';
      }
      if (!formData.password) {
        nextErrors.password = 'Password is required';
      }
    }

    if (mode === 'sign-up') {
      if (!formData.name.trim()) {
        nextErrors.name = 'Full name is required';
      }
      if (!isValidEmail(formData.email)) {
        nextErrors.email = 'Enter a valid email address';
      }
      const passwordMessage = getPasswordValidationMessage(formData.password);
      if (passwordMessage) {
        nextErrors.password = passwordMessage;
      }
      if (!formData.confirmPassword) {
        nextErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.confirmPassword !== formData.password) {
        nextErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (mode === 'forgot-password') {
      if (!isValidEmail(formData.email)) {
        nextErrors.email = 'Enter a valid email address';
      }
    }

    if (mode === 'reset-password') {
      const passwordMessage = getPasswordValidationMessage(formData.password);
      if (passwordMessage) {
        nextErrors.password = passwordMessage;
      }
      if (!formData.confirmPassword) {
        nextErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.confirmPassword !== formData.password) {
        nextErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      if (mode === 'sign-in') {
        const result = await login(formData.email, formData.password);

        if (!result.success) {
          setErrors({ submit: result.error });
          return;
        }

        clearPendingAuthJourney();
        toast({
          title: 'Signed in',
          description: 'Your account is ready.',
          variant: 'success',
        });
        navigateAfterAuth();
        return;
      }

      if (mode === 'sign-up') {
        const result = await signup(formData.name.trim(), formData.email, formData.password);

        if (!result.success) {
          setErrors({ submit: result.error });
          return;
        }

        if (result.confirmationRequired) {
          persistPendingAuthJourney({
            email: formData.email,
            next: nextPath,
            intent: 'signup',
          });
          setPendingEmail(formData.email);
          updateMode('check-email', {
            email: formData.email,
            intent: 'signup',
            message: result.message,
          });
          toast({
            title: 'Check your email',
            description: result.message,
            variant: 'success',
          });
          return;
        }

        clearPendingAuthJourney();
        toast({
          title: 'Account created',
          description: 'You are signed in and ready to continue.',
          variant: 'success',
        });
        navigateAfterAuth();
        return;
      }

      if (mode === 'forgot-password') {
        const response = await authAPI.forgotPassword(formData.email);
        clearRecoverySession();
        persistPendingAuthJourney({
          email: formData.email,
          next: nextPath,
          intent: 'recovery',
        });
        setPendingEmail(formData.email);
        updateMode('check-email', {
          email: formData.email,
          intent: 'recovery',
          message: response.data.message,
        });
        toast({
          title: 'Reset email sent',
          description: response.data.message,
        });
        return;
      }

      if (mode === 'reset-password') {
        const recoveryState = await resolveRecoverySession();
        const accessToken = recoveryState?.session?.access_token || localStorage.getItem('authToken');
        const refreshToken = recoveryState?.session?.refresh_token || localStorage.getItem('refreshToken');

        if (!accessToken) {
          clearRecoverySession();
          setErrors({
            submit: 'Your reset link is missing or expired. Request a new password reset email and try again.',
          });
          return;
        }

        const response = await authAPI.updatePassword(formData.password, {
          accessToken,
          refreshToken,
        });
        if (recoveryState?.session) {
          try {
            await applySession(recoveryState.session, recoveryState.user || null);
          } catch (sessionError) {
            console.warn('Unable to warm authenticated session after password reset:', sessionError);
          }
        }

        clearRecoverySession();
        clearPendingAuthJourney();
        setFormData((current) => ({
          ...current,
          password: '',
          confirmPassword: '',
        }));
        updateMode('confirmed', {
          email: pendingEmail || formData.email,
          intent: 'recovery',
          message: response.data.message,
        });
        toast({
          title: 'Password updated',
          description: response.data.message,
          variant: 'success',
        });
      }
    } catch (error) {
      setErrors({
        submit: error.response?.data?.error || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (!pendingEmail) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (pendingIntent === 'recovery') {
        const response = await authAPI.forgotPassword(pendingEmail);
        clearRecoverySession();
        setFeedbackMessage(response.data.message);
        toast({
          title: 'Reset email sent again',
          description: response.data.message,
        });
      } else {
        const response = await authAPI.resendConfirmation(pendingEmail);
        setFeedbackMessage(response.data.message);
        toast({
          title: 'Confirmation email sent again',
          description: response.data.message,
        });
      }
    } catch (error) {
      setErrors({
        submit: error.response?.data?.error || 'Unable to resend email right now.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (errors[name] || errors.submit) {
      setErrors((current) => ({
        ...current,
        [name]: '',
        submit: '',
      }));
    }
  };

  const formFields = (
    <>
      {mode === 'sign-up' && (
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-foreground">
            Full Name
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              className={`input-field h-12 pl-10 ${errors.name ? 'border-rose-300 focus-visible:ring-rose-300' : ''}`}
              placeholder="Enter your full name"
              autoComplete="name"
            />
          </div>
          {errors.name && <p className="mt-2 text-sm text-rose-700">{errors.name}</p>}
        </div>
      )}

      {(mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot-password') && (
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`input-field h-12 pl-10 ${errors.email ? 'border-rose-300 focus-visible:ring-rose-300' : ''}`}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          {errors.email && <p className="mt-2 text-sm text-rose-700">{errors.email}</p>}
        </div>
      )}

      {(mode === 'sign-in' || mode === 'sign-up' || mode === 'reset-password') && (
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              className={`input-field h-12 pl-10 ${errors.password ? 'border-rose-300 focus-visible:ring-rose-300' : ''}`}
              placeholder={mode === 'reset-password' ? 'Create a new password' : 'Enter your password'}
              autoComplete={mode === 'reset-password' ? 'new-password' : mode === 'sign-up' ? 'new-password' : 'current-password'}
            />
          </div>
          {(mode === 'sign-up' || mode === 'reset-password') && (
            <p className="mt-2 text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
          )}
          {errors.password && <p className="mt-2 text-sm text-rose-700">{errors.password}</p>}
        </div>
      )}

      {(mode === 'sign-up' || mode === 'reset-password') && (
        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-foreground">
            Confirm Password
          </label>
          <div className="relative">
            <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`input-field h-12 pl-10 ${errors.confirmPassword ? 'border-rose-300 focus-visible:ring-rose-300' : ''}`}
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
          </div>
          {errors.confirmPassword && <p className="mt-2 text-sm text-rose-700">{errors.confirmPassword}</p>}
        </div>
      )}
    </>
  );

  const sidePanel = (
    <div className={`${isPageVariant ? 'hidden border-r bg-[#23442a] px-8 py-10 text-white lg:flex lg:flex-col' : 'hidden'}`}>
      <div className="max-w-sm space-y-6">
        <div className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          GovindJi Account
        </div>
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight">Your personal dry fruits & nuts shop.</h2>
          <p className="mt-4 text-sm leading-7 text-white/75">
            Create an account to enjoy personalized shopping, save your favorites, and get recommendations just for you.
          </p>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-white/75" />
              <div>
                <p className="text-sm font-semibold">Save your favorites</p>
                <p className="mt-1 text-sm text-white/70">Keep track of your preferred almonds, cashews, dried fruits and more. Reorder in seconds with your saved selections.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-white/75" />
              <div>
                <p className="text-sm font-semibold">Track your orders</p>
                <p className="mt-1 text-sm text-white/70">View your order history, track deliveries, and know exactly when your fresh dry fruits are arriving at your doorstep.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-white/75" />
              <div>
                <p className="text-sm font-semibold">Exclusive deals & offers</p>
                <p className="mt-1 text-sm text-white/70">Members get first access to seasonal specials, bulk discounts, and exclusive blends you won't find anywhere else.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const checkEmailView = (
    <div className="space-y-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#23442a]/10 text-[#23442a]">
        <Mail className="h-7 w-7" />
      </div>
      <div className="space-y-2 text-center">
        <p className="page-eyebrow">{pendingIntent === 'recovery' ? 'Password reset' : 'Confirm your email'}</p>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Check your inbox</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {feedbackMessage || 'We sent a secure email so you can continue this account flow.'}
        </p>
      </div>
      <div className="surface-card-muted p-4 text-sm text-foreground">
        <p className="font-semibold">Email</p>
        <p className="mt-1 break-all text-muted-foreground">{pendingEmail || 'Update your email and try again.'}</p>
      </div>
      <div className="grid gap-3">
        <button
          type="button"
          onClick={handleResendEmail}
          disabled={!pendingEmail || isSubmitting}
          className="store-button-primary w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              {pendingIntent === 'recovery' ? 'Send Reset Link Again' : 'Resend Confirmation Email'}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => updateMode(pendingIntent === 'recovery' ? 'forgot-password' : 'sign-up', { email: pendingEmail })}
          className="store-button-secondary w-full"
        >
          Change Email
        </button>
        <button
          type="button"
          onClick={() => updateMode('sign-in', { email: pendingEmail })}
          className="btn-outline w-full py-3 text-sm"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );

  const confirmedView = (
    <div className="space-y-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <div className="space-y-2 text-center">
        <p className="page-eyebrow">{pendingIntent === 'recovery' ? 'Password updated' : 'Account confirmed'}</p>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {pendingIntent === 'recovery' ? 'Your password is updated' : 'You are signed in'}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {feedbackMessage || 'Continue back into the storefront.'}
        </p>
      </div>
      <div className="grid gap-3">
        <button type="button" onClick={navigateAfterAuth} className="store-button-primary w-full">
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </button>
        <button type="button" onClick={() => navigate('/orders')} className="store-button-secondary w-full">
          Go to My Orders
        </button>
      </div>
    </div>
  );

  return (
    <div className={`overflow-hidden ${isPageVariant ? 'surface-section' : ''}`}>
      <div className={isPageVariant ? 'grid lg:grid-cols-[0.92fr_1.08fr]' : ''}>
        {sidePanel}

        <div className={`${isPageVariant ? 'px-6 py-8 sm:px-8 lg:px-10 lg:py-10' : 'px-1 py-1'}`}>
          <div className="mx-auto max-w-lg space-y-6">
            {!['check-email', 'confirmed'].includes(mode) && (
              <div className="space-y-3">
                <p className="page-eyebrow">{copy.eyebrow}</p>
                <div className="space-y-2">
                  <h1 className={`${isPageVariant ? 'page-title !mt-0 !text-3xl' : 'font-heading text-2xl font-semibold tracking-tight text-foreground'}`}>
                    {copy.title}
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">{copy.description}</p>
                </div>

                {(mode === 'sign-in' || mode === 'sign-up') && (
                  <div className="tab-list max-w-sm">
                    <button
                      type="button"
                      onClick={() => updateMode('sign-in', { email: formData.email })}
                      className={`tab-button ${mode === 'sign-in' ? 'tab-button-selected' : 'tab-button-unselected'}`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMode('sign-up', { email: formData.email })}
                      className={`tab-button ${mode === 'sign-up' ? 'tab-button-selected' : 'tab-button-unselected'}`}
                    >
                      Sign Up
                    </button>
                  </div>
                )}
              </div>
            )}

            {reason === 'session-expired' && mode === 'sign-in' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Your session expired. Sign in again to continue where you left off.
              </div>
            )}

            {errors.submit && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errors.submit}
              </div>
            )}

            {isProcessingLink ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 px-6 py-14 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#23442a]" />
                <div>
                  <p className="font-semibold text-foreground">Finishing your secure sign-in</p>
                  <p className="mt-1 text-sm text-muted-foreground">Please wait while we verify the email link.</p>
                </div>
              </div>
            ) : mode === 'check-email' ? (
              checkEmailView
            ) : mode === 'confirmed' ? (
              confirmedView
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {formFields}

                {mode === 'sign-in' && (
                  <button
                    type="button"
                    onClick={() => updateMode('forgot-password', { email: formData.email })}
                    className="text-sm font-medium text-[#23442a] transition-colors hover:text-[#1d3722]"
                  >
                    Forgot your password?
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="store-button-primary w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Working...
                    </>
                  ) : (
                    <>
                      {copy.submitLabel}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="border-t border-border/70 pt-4 text-sm text-muted-foreground">
                  {mode === 'sign-in' && (
                    <p>
                      New here?{' '}
                      <button
                        type="button"
                        onClick={() => updateMode('sign-up', { email: formData.email })}
                        className="font-semibold text-[#23442a] hover:text-[#1d3722]"
                      >
                        Create an account
                      </button>
                    </p>
                  )}
                  {mode === 'sign-up' && (
                    <p>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => updateMode('sign-in', { email: formData.email })}
                        className="font-semibold text-[#23442a] hover:text-[#1d3722]"
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                  {mode === 'forgot-password' && (
                    <p>
                      Remembered it?{' '}
                      <button
                        type="button"
                        onClick={() => updateMode('sign-in', { email: formData.email })}
                        className="font-semibold text-[#23442a] hover:text-[#1d3722]"
                      >
                        Back to sign in
                      </button>
                    </p>
                  )}
                  {mode === 'reset-password' && (
                    <p>
                      Need a fresh link?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          clearRecoverySession();
                          updateMode('forgot-password', { email: pendingEmail || formData.email });
                        }}
                        className="font-semibold text-[#23442a] hover:text-[#1d3722]"
                      >
                        Request another reset email
                      </button>
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthFlow;
