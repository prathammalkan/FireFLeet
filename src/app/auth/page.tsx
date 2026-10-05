'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Flame, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';


export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn, signInWithGoogle } = useAuth();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      await signIn(email);
      setSent(true);
    } catch {
      setError('Failed to send link. Check your email and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setError('Google sign-in failed. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="page-root flex flex-col items-center justify-center px-5 overflow-hidden">
      {/* Subtle bg glow — pointer-events-none so it doesn't block touches */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-sm animate-fade-slide-up">
        {/* Logo — single idle animation only */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#f97316] to-[#ea580c] mx-auto mb-5 flex items-center justify-center shadow-2xl shadow-orange-500/30">
            <Flame className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">FireFleet</h1>
          <p className="text-[#9ca3af] mt-1">Plan your wealth</p>
        </div>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="text-center bg-[#13131a] border border-[#22c55e]/30 rounded-3xl p-8"
            >
              <div className="text-5xl mb-4">📬</div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-[#9ca3af] text-sm">
                We sent a magic link to <strong className="text-white">{email}</strong>.
                Tap it to sign in instantly.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-6 text-[#f97316] text-sm font-semibold active:opacity-70"
              >
                Use a different email
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-[#13131a] border border-[#1f1f2e] text-white font-semibold flex items-center justify-center gap-3 mb-4 active:bg-[#1a1a24] transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4 my-5">
                <div className="flex-1 h-px bg-[#1f1f2e]" />
                <span className="text-[#4b5563] text-sm">or</span>
                <div className="flex-1 h-px bg-[#1f1f2e]" />
              </div>

              <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    aria-label="Email address"
                    className="w-full h-14 bg-[#13131a] border border-[#1f1f2e] rounded-2xl pl-11 pr-4 text-white placeholder:text-[#4b5563] outline-none focus:border-[#f97316] transition-colors"
                    style={{ fontSize: 16 }}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                {error && (
                  <p className="text-[#ef4444] text-sm text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold text-base flex items-center justify-center gap-2 active:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {loading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                  ) : (
                    <>Send Magic Link <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <p className="text-center text-[#4b5563] text-xs mt-6">
                By continuing, you agree to our{' '}
                <a href="/terms" className="text-[#f97316] underline">Terms</a> &{' '}
                <a href="/privacy" className="text-[#f97316] underline">Privacy Policy</a>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
