import { useState, type FormEvent } from 'react';
import { loginUser, registerUser } from '../lib/api';

interface AuthPageProps {
  onAuthSuccess: (user: { id: number; username: string }, token: string) => void;
}

export const AuthPage = ({ onAuthSuccess }: AuthPageProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const action = mode === 'login' ? loginUser : registerUser;
    const result = await action(username.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.token && result.user) {
      onAuthSuccess(result.user, result.token);
    } else {
      setError('Unexpected server response.');
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
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

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
