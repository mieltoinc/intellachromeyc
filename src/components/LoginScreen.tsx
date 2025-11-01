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
              <label htmlFor="password" className="block text-sm font-medium text-blue-900 mb-2">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700"
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
              disabled={isLoading || !email || !password}
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