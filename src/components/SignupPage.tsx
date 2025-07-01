import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles, Users, Zap, Brain, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../modules/auth/hooks/useAuth';

interface SignupPageProps {
  onSuccess: () => void;
  onBackToLanding: () => void;
  onSignIn: () => void; // New prop for sign in navigation
}

export default function SignupPage({ onSuccess, onBackToLanding, onSignIn }: SignupPageProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      const { data, error } = await signUp(formData.email, formData.password, formData.name);
      
      if (error) {
        setError(error.message);
      } else if (data.user) {
        onSuccess();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const benefits = [
    "Create unlimited AI agents",
    "Connect to 50+ data sources",
    "Voice conversations with natural speech",
    "Advanced document analysis",
    "Custom workflows & automation",
    "Enterprise-grade security"
  ];

  const stats = [
    { number: "50K+", label: "AI Agents Created" },
    { number: "2M+", label: "Conversations" },
    { number: "99.9%", label: "Uptime" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 flex">
      {/* Left Side - Signup Form */}
      <div className="w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Join Gather</h1>
            <p className="text-slate-400">
              Start building your AI dream team today
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                className="w-full bg-slate-800/50 backdrop-blur-sm text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 placeholder-slate-400"
                placeholder="Enter your full name"
              />
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
                className="w-full bg-slate-800/50 backdrop-blur-sm text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 placeholder-slate-400"
                placeholder="Enter your email"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  className="w-full bg-slate-800/50 backdrop-blur-sm text-white px-4 py-3 pr-12 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 placeholder-slate-400"
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Must be at least 6 characters</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#186799] to-purple-600 hover:from-[#1a5a7a] hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 text-white py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <button
                onClick={onSignIn}
                className="text-[#186799] hover:text-[#1a5a7a] font-medium transition-colors duration-200"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Graphics & Copy */}
      <div className="w-1/2 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-gradient-to-br from-[#186799]/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-48 h-48 bg-gradient-to-tr from-purple-600/20 to-[#186799]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-[#186799]/10 to-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-center p-12">
          {/* Main Headline */}
          <div className="mb-12">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-6">
              <Sparkles className="w-4 h-4 text-[#6143fa]" />
              <span className="text-sm font-medium text-white">Join 50,000+ innovators</span>
            </div>
            
            <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
              Stop Working Alone.
              <br />
              <span className="bg-gradient-to-r from-[#186799] to-purple-600 bg-clip-text text-transparent">
                Build Your AI Team.
              </span>
            </h2>
            
            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              While others struggle with single chatbots, you'll command a specialized team of AI agents that know your business, understand your goals, and deliver results that matter.
            </p>
          </div>

          {/* Benefits List */}
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-white mb-4">What you get instantly:</h3>
            <div className="space-y-3">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-[#186799] to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl font-bold bg-gradient-to-r from-[#186799] to-purple-600 bg-clip-text text-transparent mb-1">
                  {stat.number}
                </div>
                <div className="text-slate-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Floating AI Icons */}
          <div className="absolute top-32 right-32 w-16 h-16 bg-gradient-to-br from-[#186799]/20 to-purple-600/20 rounded-2xl backdrop-blur-sm border border-white/10 flex items-center justify-center animate-bounce">
            <Brain className="w-8 h-8 text-[#186799]" />
          </div>
          <div className="absolute bottom-32 right-16 w-12 h-12 bg-gradient-to-br from-purple-600/20 to-[#186799]/20 rounded-xl backdrop-blur-sm border border-white/10 flex items-center justify-center animate-bounce" style={{ animationDelay: '1s' }}>
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div className="absolute top-1/2 right-8 w-14 h-14 bg-gradient-to-br from-[#186799]/20 to-purple-600/20 rounded-xl backdrop-blur-sm border border-white/10 flex items-center justify-center animate-bounce" style={{ animationDelay: '2s' }}>
            <Users className="w-7 h-7 text-[#186799]" />
          </div>
        </div>
      </div>
    </div>
  );
}