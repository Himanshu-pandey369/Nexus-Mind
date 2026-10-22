import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvide } from '../../utils/firebase'
import api from '../../utils/axios'

const googleLogin = async (onLogin) => {
  try {
    const data = await signInWithPopup(auth, googleProvide)
    const idToken = await data.user.getIdToken()
    const response = await api.post('/auth', { idToken })
    onLogin(response.data.user)
  } catch (error) {
    console.error(error.response?.data?.message || error.message)
  }
}


function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      )}
    </svg>
  )
}

export default function Login({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex min-h-svh bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Brand panel */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 -bottom-32 h-112 w-md rounded-full bg-fuchsia-400/30 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur">N</div>
          <span className="text-xl font-semibold tracking-tight">NexusMind</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">Where your ideas connect.</h1>
          <p className="mt-4 text-lg text-white/80">
            Capture thoughts, link knowledge, and let your second brain do the heavy lifting.
          </p>
        </div>

        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} NexusMind</p>
      </aside>

      {/* Form panel */}
      <main className="flex w-full items-center justify-center px-4 py-12 sm:px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-fuchsia-600 text-lg font-bold text-white">N</div>
            <span className="text-xl font-semibold tracking-tight">NexusMind</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign in to continue to your workspace.</p>

          <button
            type="button"
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
            onClick={() => googleLogin(onLogin)}
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs tracking-wide text-slate-400 uppercase">or</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>


          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Sign up</a>
          </p>
        </div>
      </main>
    </div>
  )
}
