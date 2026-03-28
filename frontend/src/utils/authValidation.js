export const PASSWORD_POLICY_HINT = 'Use at least 8 characters with uppercase, lowercase, a number, and a special character.';

export const isStrongPassword = (password = '') => (
  typeof password === 'string' &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password)
);

export const getPasswordValidationMessage = (password = '') => {
  if (!password) {
    return 'Password is required';
  }

  if (!isStrongPassword(password)) {
    return PASSWORD_POLICY_HINT;
  }

  return '';
};

export const isValidEmail = (email = '') => /\S+@\S+\.\S+/.test(email);
