import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// For development, provide fallback or clear instructions
if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url_here') {
  console.error('🔧 SETUP REQUIRED: Please configure your Supabase URL');
  console.error('👉 Create a .env file in your project root with:');
  console.error('   VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   VITE_SUPABASE_ANON_KEY=your-anon-key-here');
  console.error('💡 Get these values from your Supabase project dashboard');
}

if (!supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key_here') {
  console.error('🔧 SETUP REQUIRED: Please configure your Supabase Anon Key');
  console.error('👉 Add VITE_SUPABASE_ANON_KEY to your .env file');
}

// Validate environment variables and provide helpful errors
if (!supabaseUrl) {
  throw new Error('🚫 Missing VITE_SUPABASE_URL environment variable. Please create a .env file with your Supabase URL.');
}

if (!supabaseAnonKey) {
  throw new Error('🚫 Missing VITE_SUPABASE_ANON_KEY environment variable. Please add your Supabase anon key to the .env file.');
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Export the URL and key for other modules that might need them
export { supabaseUrl, supabaseAnonKey };

// Log successful connection in development
if (import.meta.env.DEV) {
  console.log('✅ Supabase client initialized successfully');
  console.log('🔗 Connected to:', supabaseUrl);
}