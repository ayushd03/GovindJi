import React from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthFlow from '../components/auth/AuthFlow';
import { useAuth } from '../context/AuthContext';
import { buildAuthPath, getPostAuthDestination, normalizeAuthMode } from '../utils/authRouting';

const Auth = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mode = normalizeAuthMode(searchParams.get('mode'));
  const nextPath = searchParams.get('next') || '';
  const reason = searchParams.get('reason') || '';
  const email = searchParams.get('email') || '';

  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const hasIncomingAuthLink =
    hashParams.has('access_token') ||
    hashParams.has('code') ||
    hashParams.has('error_description') ||
    hashParams.has('token_hash') ||
    searchParams.has('access_token') ||
    searchParams.has('code') ||
    searchParams.has('error_description') ||
    searchParams.has('token_hash');

  if (
    isAuthenticated &&
    !hasIncomingAuthLink &&
    !['reset-password', 'check-email', 'confirmed'].includes(mode)
  ) {
    return <Navigate to={getPostAuthDestination(nextPath, '/')} replace />;
  }

  const handleModeChange = (nextMode, options = {}) => {
    navigate(
      buildAuthPath({
        mode: nextMode,
        next: nextPath,
        email: options.email || email,
      }),
      { replace: true }
    );
  };

  return (
    <div className="page-shell-soft py-8">
      <div className="page-container">
        <AuthFlow
          variant="page"
          mode={mode}
          nextPath={nextPath}
          reason={reason}
          email={email}
          onModeChange={handleModeChange}
        />
      </div>
    </div>
  );
};

export default Auth;
