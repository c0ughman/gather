import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';

interface OAuthConnectProps {
  provider: string;
  onSuccess: (tokenId: string) => void;
  onError: (error: string) => void;
  className?: string;
}

export default function OAuthConnect({ 
  provider, 
  onSuccess, 
  onError, 
  className = '' 
}: OAuthConnectProps) {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to prevent infinite loops
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  
  // Update refs when props change
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  // Check if already connected (simulate for now)
  useEffect(() => {
    if (user) {
      // For now, we'll check localStorage for a simple connection status
      const connectionKey = `oauth_connected_${provider}_${user.id}`;
      const isAlreadyConnected = localStorage.getItem(connectionKey) === 'true';
      if (isAlreadyConnected && !isConnected) {
        setIsConnected(true);
        onSuccessRef.current('mock-token-id'); // Simulate token ID
      }
    }
  }, [user, provider, isConnected]);

  // Listen for OAuth completion from callback
  useEffect(() => {
    const handleOAuthComplete = (event: CustomEvent) => {
      if (event.detail.provider === provider && event.detail.success) {
        console.log('🎉 OAuth completed for provider:', provider);
        setIsConnected(true);
        setIsConnecting(false);
        
        // Store connection status
        if (user) {
          const connectionKey = `oauth_connected_${provider}_${user.id}`;
          localStorage.setItem(connectionKey, 'true');
        }
        
        onSuccessRef.current('mock-token-id');
      } else if (event.detail.provider === provider && !event.detail.success) {
        setIsConnecting(false);
        onErrorRef.current(event.detail.error || 'OAuth failed');
      }
    };

    window.addEventListener('oauth-complete', handleOAuthComplete as EventListener);
    return () => window.removeEventListener('oauth-complete', handleOAuthComplete as EventListener);
  }, [provider, user]);

  const handleConnect = async () => {
    if (!user) {
      onErrorRef.current('User not authenticated');
      return;
    }

    // Get client credentials from environment variables
    const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_NOTION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      onErrorRef.current('Notion OAuth credentials not configured. Please add VITE_NOTION_CLIENT_ID and VITE_NOTION_CLIENT_SECRET to your environment variables.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('🔗 Starting OAuth connection for provider:', provider);
      
      // Generate dynamic redirect URI based on current origin
      const redirectUri = `${window.location.origin}/oauth/callback/${provider}`;
      console.log('🔗 Using redirect URI:', redirectUri);
      
      // Generate auth URL with state
      const state = btoa(JSON.stringify({ 
        userId: user.id, 
        provider,
        timestamp: Date.now(),
        returnTo: window.location.pathname // Store where to return after OAuth
      }));
      
      console.log('🔗 Generated state for OAuth:', { userId: user.id, provider });
      
      // Create OAuth URL for Notion
      const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      
      // Store config in session for callback (simplified)
      const configKey = `oauth_config_${provider}`;
      sessionStorage.setItem(configKey, JSON.stringify({
        provider,
        clientId,
        clientSecret,
        redirectUri
      }));
      console.log('💾 Stored OAuth config in session storage with key:', configKey);
      
      // Redirect to OAuth provider
      console.log('🚀 Redirecting to OAuth provider:', authUrl);
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('❌ OAuth connection error:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect');
      onErrorRef.current(error instanceof Error ? error.message : 'Failed to connect');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      // Remove connection status from localStorage
      const connectionKey = `oauth_connected_${provider}_${user.id}`;
      localStorage.removeItem(connectionKey);
      setIsConnected(false);
      setError(null);
    } catch (error) {
      console.error('Error disconnecting OAuth:', error);
      setError('Failed to disconnect');
    }
  };

  const getProviderDisplayName = (provider: string): string => {
    const names: Record<string, string> = {
      notion: 'Notion',
      google: 'Google',
      slack: 'Slack',
      github: 'GitHub',
      discord: 'Discord',
      microsoft: 'Microsoft'
    };
    return names[provider] || provider;
  };

  const getProviderColor = (provider: string): string => {
    const colors: Record<string, string> = {
      notion: '#000000',
      google: '#4285f4',
      slack: '#4a154b',
      github: '#333333',
      discord: '#5865f2',
      microsoft: '#0078d4'
    };
    return colors[provider] || '#6b7280';
  };

  if (isConnected) {
    return (
      <div className={`flex items-center justify-between p-4 bg-green-900 bg-opacity-20 border border-green-700 rounded-lg ${className}`}>
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-300">
              Connected to {getProviderDisplayName(provider)}
            </p>
            <p className="text-xs text-green-400">
              Integration is ready to use
            </p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-3 py-1 text-xs text-green-300 hover:text-green-200 border border-green-600 hover:border-green-500 rounded-full transition-colors duration-200"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className={`p-4 border border-slate-600 rounded-lg bg-slate-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: getProviderColor(provider) }}
          >
            {getProviderDisplayName(provider)[0]}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">
              Connect to {getProviderDisplayName(provider)}
            </h3>
            <p className="text-xs text-slate-400">
              Authorize access to your {getProviderDisplayName(provider)} account
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-center space-x-2 p-2 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-[#186799] hover:bg-[#1a5a7a] disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-full transition-colors duration-200 text-sm"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <ExternalLink className="w-4 h-4" />
            <span>Connect {getProviderDisplayName(provider)}</span>
          </>
        )}
      </button>

      <p className="mt-2 text-xs text-slate-400">
        You'll be redirected to {getProviderDisplayName(provider)} to authorize this integration.
      </p>
    </div>
  );
}