import { createClient } from '@supabase/supabase-js';

// Environment variables in Vite need to be prefixed with VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Debug logging for configuration
console.log('🔧 SUPABASE CONFIG - URL:', supabaseUrl);
console.log('🔧 SUPABASE CONFIG - Key starts with:', supabaseAnonKey?.substring(0, 10) + '...');
console.log('🔧 SUPABASE CONFIG - Key length:', supabaseAnonKey?.length);

// Validate configuration
if (supabaseUrl === 'https://your-project.supabase.co') {
  console.error('⚠️ SUPABASE CONFIG - Using placeholder URL! Please update VITE_SUPABASE_URL in .env');
}

if (supabaseAnonKey === 'your-anon-key') {
  console.error('⚠️ SUPABASE CONFIG - Using placeholder key! Please update VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const auth = {
  signIn: (email: string, password: string) => 
    supabase.auth.signInWithPassword({ email, password }),
  
  signUp: (email: string, password: string) => 
    supabase.auth.signUp({ email, password }),
  
  signOut: () => supabase.auth.signOut(),
  
  getSession: () => supabase.auth.getSession(),
  
  refreshSession: () => supabase.auth.refreshSession(),
  
  updatePassword: (password: string) => 
    supabase.auth.updateUser({ password }),
  
  resetPassword: (email: string) => 
    supabase.auth.resetPasswordForEmail(email),
};