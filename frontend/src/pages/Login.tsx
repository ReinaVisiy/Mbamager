import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate, useLocation } from 'react-router';
import { Coins, LogIn, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { storage } from '../utils/format';

// Validation schema matching email format or Cameroon standard +2376XXXXXXXX format and backend limits
const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or Phone Number is required')
    .refine((val) => {
      // If it contains @, validate email, else validate phone
      if (val.includes('@')) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
      }
      return /^\+2376\d{8}$/.test(val);
    }, {
      message: 'Enter a valid email address or phone number (+2376XXXXXXXX)',
    }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  remember_me: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, isAuthenticated, error: storeError, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // Check if there is a saved phone number from Remember Me
  const savedPhone = storage.get<string>('mb_remember_phone', '');
  const hasSavedPhone = !!savedPhone;

  // Prevent authenticated users from accessing /login
  React.useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Determine redirection target post-success
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: savedPhone || '',
      password: '',
      remember_me: hasSavedPhone,
    },
  });

  // Clear any existing store level auth errors on mount
  React.useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setApiError(null);
    clearError();
    try {
      // 1. Submit login request and load user (handled by Zustand store action)
      await login(data.identifier, data.password, data.remember_me);

      // 2. Handle Remember Me storage logic
      if (data.remember_me) {
        storage.set('mb_remember_phone', data.identifier);
      } else {
        storage.remove('mb_remember_phone');
      }

      // 3. Transition to dashboard view
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Login failure:', err);
      // Fallback to error message from store if available, else local error
      setApiError(err.message || 'Incorrect credentials or server offline.');
    } finally {
      setIsLoading(false);
    }
  };

  // If already authenticated, render nothing while redirecting
  if (isAuthenticated()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative">
      {/* Soft luxury gold background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.06)_0%,_transparent_65%)] pointer-events-none" />
      
      <div className="relative w-full max-w-md">
        {/* Brand logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <span className="p-4 bg-gradient-to-tr from-gold-500 to-gold-400 rounded-3xl shadow-xl shadow-gold-500/20 text-white mb-2">
            <Coins className="w-8 h-8 text-white" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Mbamager</h1>
          <p className="text-[10px] text-gold font-bold uppercase tracking-widest font-mono">
            Premium Financial OS
          </p>
        </div>

        {/* Card containing login form */}
        <Card className="shadow-xl shadow-slate-950/20 border-slate-800/80 bg-slate-900/90 p-8 rounded-3xl">
          <div className="flex items-center gap-2.5 mb-6">
            <LogIn className="w-4 h-4 text-gold-400" />
            <h2 className="text-sm font-bold text-slate-100 tracking-tight">Access Your Wallet</h2>
          </div>

          {(apiError || storeError) && (
            <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-xs text-rose-500 font-medium mb-5 animate-pulse">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{apiError || storeError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="EMAIL OR PHONE NUMBER"
              type="text"
              placeholder="+237699999999 or user@example.com"
              error={errors.identifier?.message}
              disabled={isLoading}
              {...register('identifier')}
              helperText="e.g., user@example.com or +2376XXXXXXXX"
            />

            <div className="relative flex flex-col">
              <Input
                label="PASSWORD"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.password?.message}
                disabled={isLoading}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-4 top-[36px] text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 text-xs text-slate-500 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isLoading}
                  className="rounded border-slate-800 bg-slate-950 text-gold-500 focus:ring-gold-500 focus:ring-offset-slate-950 w-4 h-4 cursor-pointer accent-gold-500"
                  {...register('remember_me')}
                />
                Remember Me
              </label>

              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-slate-500 hover:text-gold transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" variant="primary" className="w-full mt-4" isLoading={isLoading} disabled={isLoading}>
              Secure Login
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500 font-medium">
              Don't have an active account?{' '}
              <Link to="/register" className="text-gold hover:underline font-bold">
                Create Account
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
