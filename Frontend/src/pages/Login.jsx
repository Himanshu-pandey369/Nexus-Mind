import { useState, useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvide } from '../../utils/firebase';
import api from '../../utils/axios';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-400 shrink-0">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
    </svg>
  );
}

export default function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(
    typeof window !== 'undefined' &&
      (window.location.hash === '#signup' || window.location.hash === '#register' || window.location.hash === '#')
  );
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Sync state with window location hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setIsSignUp(
        window.location.hash === '#signup' ||
        window.location.hash === '#register' ||
        window.location.hash === '#'
      );
      setAuthError(null);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const toggleMode = (signUp) => {
    setIsSignUp(signUp);
    setAuthError(null);
    if (typeof window !== 'undefined') {
      window.location.hash = signUp ? '#signup' : '';
    }
  };

  const handleGoogleAuth = async () => {
    if (loading) return;
    setLoading(true);
    setAuthError(null);
    try {
      const data = await signInWithPopup(auth, googleProvide);
      const idToken = await data.user.getIdToken();
      const response = await api.post('/auth', { idToken });
      onLogin(response.data.user);
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in cancelled. Please try again.');
      } else {
        const msg =
          error.response?.data?.message ||
          error.message ||
          'Authentication failed. Please try again.';
        setAuthError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 -bottom-32 h-112 w-md rounded-full bg-fuchsia-400/30 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur select-none">
            N
          </div>
          <span className="text-xl font-semibold tracking-tight">NexusMind</span>
        </div>

        <div className="relative max-w-md space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl leading-tight font-semibold tracking-tight">
              {isSignUp ? 'Start building with intelligent agents.' : 'Where your ideas connect.'}
            </h1>
            <p className="text-lg text-white/80 leading-relaxed">
              {isSignUp
                ? 'Create presentations, generate multi-file codebases, analyze documents, and research the web with AI.'
                : 'Capture thoughts, link knowledge, and let your second brain do the heavy lifting.'}
            </p>
          </div>

          {/* Value props in signup mode */}
          {isSignUp && (
            <div className="space-y-2.5 pt-2 border-t border-white/15">
              <div className="flex items-center gap-2.5 text-sm text-white/90">
                <CheckIcon />
                <span><strong>1,000 free credits</strong> to get started immediately</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-white/90">
                <CheckIcon />
                <span>Full access to Coding, PDF, PPT, and Search Agents</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-white/90">
                <CheckIcon />
                <span>Live artifact preview with interactive code editing</span>
              </div>
            </div>
          )}
        </div>

        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} NexusMind. All rights reserved.</p>
      </aside>

      {/* Form panel */}
      <main className="flex w-full items-center justify-center px-4 py-12 sm:px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile brand header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-lg font-bold text-white select-none">
              N
            </div>
            <span className="text-xl font-semibold tracking-tight">NexusMind</span>
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-semibold tracking-tight">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {isSignUp
              ? 'Get started with 1,000 free credits to explore NexusMind.'
              : 'Sign in to continue to your workspace.'}
          </p>

          {/* Benefits pill on Sign Up */}
          {isSignUp && (
            <div className="mt-5 rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 text-xs text-indigo-300 flex items-start gap-2.5">
              <span className="text-amber-400 text-sm leading-none shrink-0">⚡</span>
              <div>
                <p className="font-semibold text-slate-200">1,000 Credits Included</p>
                <p className="mt-0.5 text-slate-400">Sign up with your Google account to instantly claim your free credits.</p>
              </div>
            </div>
          )}

          {/* Error alert */}
          {authError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-800 bg-red-950/60 p-3 text-xs text-red-300"
            >
              <span className="font-semibold">Error: </span>
              {authError}
            </div>
          )}

          {/* Primary Google Auth CTA */}
          <button
            type="button"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            onClick={handleGoogleAuth}
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            ) : (
              <GoogleIcon />
            )}
            <span>
              {loading
                ? 'Connecting to Google...'
                : isSignUp
                ? 'Sign up with Google'
                : 'Sign in with Google'}
            </span>
          </button>

          {/* Terms notice on Sign Up */}
          {isSignUp ? (
            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
              By creating an account, you agree to NexusMind&apos;s Terms of Service and Privacy Policy.
            </p>
          ) : (
            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-500">
              Instant login via Google OAuth with no password required.
            </p>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[11px] tracking-wider text-slate-400 uppercase">
              {isSignUp ? 'Already registered?' : 'New to NexusMind?'}
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Mode Switcher */}
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => toggleMode(false)}
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 focus:outline-none underline-offset-2 hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => toggleMode(true)}
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 focus:outline-none underline-offset-2 hover:underline cursor-pointer"
                >
                  Sign up
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
