import { useState, useEffect } from 'react';
import { stripeClient, SubscriptionData } from '../stripe-client';
import { supabase } from '../../database/lib/supabase';

export interface SubscriptionStatus {
  isLoading: boolean;
  isActive: boolean;
  subscription: SubscriptionData | null;
  plan: string;
  error: string | null;
}

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isLoading: true,
    isActive: false,
    subscription: null,
    plan: 'free',
    error: null
  });

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        console.log('🔍 Fetching subscription status');
        console.log('🔧 Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing');
        console.log('🔧 Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing');
        
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('❌ Error getting user:', userError);
          setStatus({
            isLoading: false,
            isActive: false,
            subscription: null,
            plan: 'free',
            error: `Auth error: ${userError.message}`
          });
          return;
        }

        if (!user) {
          console.log('ℹ️ No authenticated user found');
          setStatus({
            isLoading: false,
            isActive: false,
            subscription: null,
            plan: 'free',
            error: null
          });
          return;
        }

        console.log('✅ User authenticated:', user.id);
        
        // Get subscription info directly from user_profiles.preferences
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('preferences')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('❌ Error fetching user profile:', profileError);
          console.error('❌ Profile error details:', {
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
            message: profileError.message
          });
          
          // Check if user profile exists
          const { data: profileCheck, error: checkError } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
          
          if (checkError) {
            console.error('❌ Profile check error:', checkError);
          } else if (!profileCheck) {
            console.log('ℹ️ User profile does not exist, creating one...');
            // Try to create user profile
            const { error: createError } = await supabase
              .from('user_profiles')
              .insert({
                id: user.id,
                display_name: user.email || 'User',
                timezone: 'UTC',
                preferences: {},
                usage_stats: {}
              });
            
            if (createError) {
              console.error('❌ Failed to create user profile:', createError);
            } else {
              console.log('✅ User profile created successfully');
              // Retry fetching after creation
              const { data: newProfile } = await supabase
                .from('user_profiles')
                .select('preferences')
                .eq('id', user.id)
                .single();
              
              if (newProfile) {
                console.log('✅ Successfully fetched new profile');
                setStatus({
                  isLoading: false,
                  isActive: false,
                  subscription: null,
                  plan: 'free',
                  error: null
                });
                return;
              }
            }
          }
          
          setStatus({
            isLoading: false,
            isActive: false,
            subscription: null,
            plan: 'free',
            error: `Profile error: ${profileError.message}`
          });
          return;
        }
        
        console.log('✅ Profile fetched successfully:', profile);
        
        // Get subscription and plan from preferences
        const subscription = profile?.preferences?.subscription;
        const plan = profile?.preferences?.plan || 'free';
        
        // Determine if subscription is active
        const isActive = subscription?.subscription_status === 'active' || 
                         subscription?.subscription_status === 'trialing';
        
        setStatus({
          isLoading: false,
          isActive,
          subscription: subscription || null,
          plan,
          error: null
        });
        
        console.log('✅ Subscription status:', { isActive, plan });
      } catch (error) {
        console.error('❌ Error fetching subscription:', error);
        setStatus({
          isLoading: false,
          isActive: false,
          subscription: null,
          plan: 'free',
          error: error instanceof Error ? error.message : 'Failed to fetch subscription'
        });
      }
    };

    fetchSubscription();
  }, []);

  return status;
}