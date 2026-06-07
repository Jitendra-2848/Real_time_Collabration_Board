import { useState, type FormEvent } from 'react';
import { loginUser, registerUser } from '../lib/api';
import toast from 'react-hot-toast';

interface AuthPageProps {
  onAuthSuccess: (user: { id: number; username: string }, token: string) => void;
}

export const AuthPage = ({ onAuthSuccess }: AuthPageProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    
    if (!username.trim() || !password) {
      toast.error('Please enter both username and password.');
      return;
    }
    
    setLoading(true);

    const action = mode === 'login' ? loginUser : registerUser;
    const result = await action(username.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.token && result.user) {
      toast.success(mode === 'login' ? 'Logged in successfully!' : 'Account created successfully!');
      onAuthSuccess(result.user, result.token);
    } else {
      setError('Unexpected server response.');
      toast.error('Unexpected server response.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {mode === 'login' ? 'Login to Collaborate' : 'Register a new account'}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Access shared rooms and keep your board state synced in real time.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-slate-700 text-sm font-medium">Username</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-slate-500 focus:outline-none"
            placeholder="Enter a username"
          />

          <label className="block text-slate-700 text-sm font-medium">Password</label>
          <input
            value={password}
            type="password"
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-slate-500 focus:outline-none"
            placeholder="Enter a secure password"
          />

          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <span className="relative bg-white px-4 text-xs uppercase text-slate-400 font-medium">Or continue with</span>
        </div>

        <button
          type="button"
          onClick={() => {
            const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
            window.location.href = `${apiBaseUrl}/auth/google`;
          }}
          className="w-full flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-700 font-semibold hover:bg-slate-50 active:scale-98 transition-all shadow-sm"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 0, 0)">
              <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48c0,-0.64 -0.06,-1.26 -0.17,-1.8Z" fill="#4285F4" />
              <path d="M12,20.6c2.43,0 4.47,-0.8 5.96,-2.2l-3.3,-2.58c-0.9,0.6 -2.07,0.98 -3.3,0.98c-2.34,0 -4.33,-1.58 -5.04,-3.7H2.92v2.66C4.4,18.78 8.0,20.6 12,20.6Z" fill="#34A853" />
              <path d="M6.96,13.1c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7c0,-0.59 0.1,-1.16 0.28,-1.7V7.04H2.92C2.3,8.28 2,9.68 2,11.1c0,1.42 0.3,2.82 0.92,4.06l4.04,-3.06Z" fill="#FBBC05" />
              <path d="M12,6.4c1.32,0 2.5,0.45 3.44,1.35l2.58,-2.58C16.46,3.64 14.43,3 12,3C8.0,3 4.4,4.82 2.92,7.04l4.04,3.06C7.67,7.98 9.66,6.4 12,6.4Z" fill="#EA4335" />
            </g>
          </svg>
          Sign in with Google
        </button>

        <div className="mt-6 text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button onClick={() => setMode('register')} className="font-semibold text-slate-900">
                Create account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="font-semibold text-slate-900">
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
