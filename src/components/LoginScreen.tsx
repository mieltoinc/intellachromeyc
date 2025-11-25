import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { mieltoAuth } from '@/lib/auth';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      console.log('🔑 LOGIN SCREEN - Starting login for:', email);
      await mieltoAuth.signIn(email, password);
      console.log('🔑 LOGIN SCREEN - Login successful');
      onLogin();
    } catch (error: any) {
      console.error('🔑 LOGIN SCREEN - Login failed:', error);
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError('');

    try {
      console.log('🔑 LOGIN SCREEN - Starting Google sign-in');
      await mieltoAuth.signInWithGoogle();
      console.log('🔑 LOGIN SCREEN - Google sign-in successful');
      onLogin();
    } catch (error: any) {
      console.error('🔑 LOGIN SCREEN - Google sign-in failed:', error);
      setError(error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-darkBg-primary dark:to-darkBg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-blue-900 dark:text-darkText-primary">Intella</h1>
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Sign in to your Mielto account to access your memories and AI assistant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-blue-900 dark:text-darkText-secondary mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-blue-900 dark:text-darkText-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="gradient-premium"
              size="full"
              disabled={isLoading || isGoogleLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-darkBg-secondary"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-darkBg-primary text-gray-500 dark:text-darkText-tertiary">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <Button
            type="button"
            variant="outline"
            size="full"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="flex items-center justify-center gap-2 bg-white dark:bg-darkBg-secondary border-gray-300 dark:border-darkBg-tertiary hover:bg-gray-50 dark:hover:bg-darkBg-tertiary text-gray-900 dark:text-darkText-primary"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in with Google...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </>
            )}
          </Button>

          <div className="mt-6 text-center">
            <button
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              onClick={() => {
                // Open Mielto signup page
                chrome.tabs.create({ url: 'https://mielto.com/signup' });
              }}
            >
              Don't have an account? Sign up
            </button>
          </div>

          <div className="mt-4 text-center space-y-2">
            <button
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline block mx-auto"
              onClick={() => {
                // Open forgot password page
                chrome.tabs.create({ url: 'https://mielto.com/forgot-password' });
              }}
            >
              Forgot your password?
            </button>
            
            <button
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline block mx-auto"
              onClick={async () => {
                try {
                  const response = await fetch('https://api.mielto.com/auth/login', {
                    method: 'OPTIONS'
                  });
                  console.log('🔧 API Test - OPTIONS response:', response.status);
                  
                  const testResponse = await fetch('https://api.mielto.com/health', {
                    method: 'GET'
                  });
                  console.log('🔧 API Test - Health check:', testResponse.status);
                } catch (error) {
                  console.error('🔧 API Test - Connection test failed:', error);
                }
              }}
            >
              Test API Connection
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};