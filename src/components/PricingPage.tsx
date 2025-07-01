import React, { useState } from 'react';
import { Check, ArrowRight, Zap, Shield, Star, Loader2 } from 'lucide-react';
import { PRODUCTS } from '../stripe-config';
import { stripeClient } from '../modules/payments/stripe-client';

interface PricingPageProps {
  onSelectPlan: (plan: string) => void;
  onStayFree: () => void;
}

export default function PricingPage({ onSelectPlan, onStayFree }: PricingPageProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSelectPlan = async (priceId: string, planName: string) => {
    try {
      setIsLoading(planName);
      console.log(`Initiating checkout for plan: ${planName}, priceId: ${priceId}`);
      
      await stripeClient.redirectToCheckout({
        priceId,
        mode: 'subscription',
        successUrl: `${window.location.origin}/success?plan=${planName}`,
        cancelUrl: `${window.location.origin}/`,
      });
      
      // Note: The page will redirect, so we won't reach this point
      onSelectPlan(planName);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setIsLoading(null);
      alert('There was an error redirecting to checkout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white overflow-hidden">
      {/* Custom CSS for animated gradient */}
      <style jsx="true">{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animated-gradient-text {
          background: linear-gradient(-45deg, #2c2984, #332d97, #3033a8, #4244e7, #4645eb, #6143fa, #8343fb, #a54aef, #a94ae4, #c750ce, #4578ed, #5d5fed, #6b3fec, #6d3aee, #713b);
          background-size: 400% 400%;
          animation: gradientShift 8s ease-in-out infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .animated-gradient-bg {
          background: linear-gradient(-45deg, #2c2984, #332d97, #3033a8, #4244e7, #4645eb, #6143fa, #8343fb, #a54aef, #a94ae4, #c750ce, #4578ed, #5d5fed, #6b3fec, #6d3aee, #713b);
          background-size: 400% 400%;
          animation: gradientShift 8s ease-in-out infinite;
        }
      `}</style>

      {/* Navigation */}
      <nav className="relative z-50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="/media/gather-logo-light.png" 
              alt="Gather Logo" 
              className="w-10 h-10 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Gather
            </span>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="text-center pt-10 pb-16 px-4">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Choose Your <span className="animated-gradient-text">Perfect Plan</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-3xl mx-auto">
          Select the plan that best fits your needs and start building your AI dream team today.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-8">
          {PRODUCTS.map((product) => (
            <div 
              key={product.id}
              className={`${
                product.popular 
                  ? "bg-gradient-to-b from-[#186799]/20 to-slate-800/50 backdrop-blur-sm rounded-2xl border border-[#186799] overflow-hidden transform scale-105 shadow-xl shadow-[#186799]/10 transition-all duration-300 hover:shadow-[#186799]/20" 
                  : "bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden transition-all duration-300 hover:border-slate-600 hover:translate-y-[-4px]"
              }`}
            >
              {product.popular && (
                <div className="bg-[#186799] text-white text-center py-2 text-sm font-medium">
                  MOST POPULAR
                </div>
              )}
              <div className="p-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{product.name}</h3>
                    <p className="text-slate-400 mb-4">{product.description}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${
                    product.name === 'Standard' ? 'bg-slate-700/50' : 
                    product.name === 'Premium' ? 'bg-[#186799]/30' : 
                    'bg-purple-900/30'
                  }`}>
                    {product.name === 'Standard' ? <Star className="w-5 h-5 text-slate-400" /> : 
                     product.name === 'Premium' ? <Zap className="w-5 h-5 text-[#186799]" /> : 
                     <Shield className="w-5 h-5 text-purple-400" />}
                  </div>
                </div>
                
                <div className="mt-6 mb-6">
                  <span className="text-4xl font-bold text-white">${product.price}</span>
                  <span className="text-slate-400 ml-2">/month</span>
                </div>
                
                <button 
                  onClick={() => handleSelectPlan(product.priceId, product.name.toLowerCase())}
                  disabled={isLoading !== null}
                  className={`w-full py-3 px-4 rounded-lg ${
                    product.name === 'Standard' 
                      ? "border border-slate-600 text-white hover:bg-slate-700" 
                      : product.name === 'Premium'
                      ? "bg-[#186799] text-white hover:bg-[#1a5a7a] flex items-center justify-center space-x-2" 
                      : "border border-purple-700 bg-purple-900/20 text-white hover:bg-purple-900/40"
                  } transition-colors duration-200 mb-6`}
                >
                  {isLoading === product.name.toLowerCase() ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <>
                      {product.name === 'Premium' ? (
                        <div className="flex items-center justify-center space-x-2">
                          <span>Choose Premium</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      ) : (
                        product.name === 'Pro' ? 'Choose Pro' : 'Choose Standard'
                      )}
                    </>
                  )}
                </button>
                
                <div className="space-y-4">
                  {product.features?.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Free Plan Link */}
        <div className="text-center mt-10">
          <button 
            onClick={onStayFree}
            className="text-slate-400 hover:text-slate-300 text-sm transition-colors duration-200"
          >
            I'll stay with the lite version for now
          </button>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
        
        <div className="space-y-6">
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">Can I upgrade or downgrade my plan later?</h3>
            <p className="text-slate-300">Yes, you can change your plan at any time. When upgrading, you'll be charged the prorated amount for the remainder of your billing cycle. When downgrading, the new rate will apply at the start of your next billing cycle.</p>
          </div>
          
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">What happens if I reach my usage limits?</h3>
            <p className="text-slate-300">You'll receive a notification when you're approaching your limits. Once reached, you can continue using existing features but won't be able to create new agents or upload additional documents until the next billing cycle or until you upgrade your plan.</p>
          </div>
          
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">What does "Unlimited*" mean?</h3>
            <p className="text-slate-300">Unlimited plans are subject to fair usage policies. While we don't impose hard limits, we monitor usage patterns and may contact you if your usage significantly exceeds typical enterprise requirements.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            © 2024 Gather AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}