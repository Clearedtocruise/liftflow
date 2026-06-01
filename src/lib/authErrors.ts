type AuthErrorLike = {
  message?: string;
  status?: number;
  code?: string;
};

function asAuthError(error: unknown): AuthErrorLike {
  if (error && typeof error === 'object') {
    return error as AuthErrorLike;
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return {};
}

/** Maps Supabase Auth errors to user-facing copy for signup, login, and reset flows. */
export function mapAuthError(error: unknown, context: 'signup' | 'login' | 'reset' = 'login'): string {
  const { message = '', status, code } = asAuthError(error);
  const msg = message.toLowerCase();

  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests') || code === 'over_request_rate_limit') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
    return 'Incorrect email or password.';
  }

  if (msg.includes('email not confirmed') || msg.includes('email not verified')) {
    return 'Verify your email before signing in. Check your inbox for the confirmation link.';
  }

  if (msg.includes('user not found') || msg.includes('no user found')) {
    return context === 'signup'
      ? 'Could not create your account. Try a different email.'
      : 'No account found for this email. Create an account first.';
  }

  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already registered')
  ) {
    return 'An account with this email already exists. Try logging in instead.';
  }

  if (msg.includes('signup is disabled')) {
    return 'Sign up is temporarily unavailable. Please try again later.';
  }

  if (msg.includes('password') && (msg.includes('weak') || msg.includes('short') || msg.includes('least'))) {
    return message || 'Password must be at least 8 characters.';
  }

  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return 'Enter a valid email address.';
  }

  if (message) {
    return message;
  }

  return context === 'signup'
    ? 'Could not create your account. Try again.'
    : context === 'reset'
      ? 'Could not send reset email. Try again.'
      : 'Sign in failed. Check your credentials and try again.';
}
