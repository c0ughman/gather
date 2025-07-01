import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const { signIn, signUp, resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setLoading(false)
          return
        }

        console.log('🚀 Starting sign up process...')
        const { data, error } = await signUp(email, password, name)
        
        if (error) {
          console.error('❌ Sign up error:', error)
          setError(error.message)
        } else if (data.user && data.session) {
          console.log('✅ Sign up successful with session:', data.user.email)
          setMessage('Account created successfully! Welcome to Gather!')
          
          // Clear form
          setName('')
          setEmail('')
          setPassword('')
          setConfirmPassword('')
          
          // User will be automatically redirected by the auth state change
        } else if (data.user && !data.session) {
          console.log('⚠️ Sign up successful but no session - may need email confirmation')
          setMessage('Account created! Please check your email for confirmation, or try signing in.')
        } else {
          setError('Sign up failed. Please try again.')
        }
      } else {
        console.log('🚀 Starting sign in process...')
        const { data, error } = await signIn(email, password)
        
        if (error) {
          console.error('❌ Sign in error:', error)
          setError(error.message)
        } else if (data.user && data.session) {
          console.log('✅ Sign in successful:', data.user.email)
          // User will be automatically redirected by the auth state change
        } else {
          setError('Sign in failed. Please try again.')
        }
      }
    } catch (err) {
      console.error('❌ Authentication error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first')
      return
    }

    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a password reset link!')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#186799] to-purple-600 rounded-2xl mb-4">
            <img 
              src="/media/gather-logo-light.png" 
              alt="Gather Logo" 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Gather</h1>
          <p className="text-slate-400">
            {isSignUp ? 'Create your account to get started' : 'Sign in to your account'}
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-glass-panel glass-effect rounded-2xl border border-slate-700 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field (Sign Up Only) */}
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-glass-panel glass-effect text-white pl-12 pr-4 py-3 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-glass-panel glass-effect text-white pl-12 pr-4 py-3 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-glass-panel glass-effect text-white pl-12 pr-12 py-3 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field (Sign Up Only) */}
            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-glass-panel glass-effect text-white pl-12 pr-4 py-3 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200"
                    placeholder="Confirm your password"
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div className="flex items-center space-x-2 p-3 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg">
                <AlertCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <p className="text-green-300 text-sm">{message}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#186799] to-purple-600 hover:from-[#1a5a7a] hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 text-white py-3 rounded-full font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                </>
              ) : (
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
              )}
            </button>

            {/* Forgot Password */}
            {!isSignUp && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full text-[#186799] hover:text-[#1a5a7a] text-sm transition-colors duration-200"
              >
                Forgot your password?
              </button>
            )}
          </form>

          {/* Toggle Sign Up/Sign In */}
          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  setMessage(null)
                  setName('')
                  setEmail('')
                  setPassword('')
                  setConfirmPassword('')
                }}
                className="text-[#186799] hover:text-[#1a5a7a] font-medium transition-colors duration-200"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-slate-500 text-sm">
            Secure authentication powered by Supabase
          </p>
        </div>
      </div>
    </div>
  )
}