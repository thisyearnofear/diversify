/**
 * PaywallScreen - Conversational, mascot-driven paywall that follows 
 * the "continuation of experience" principle.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { GuardianMascot } from '../shared/GuardianMascot';

interface PaywallScreenProps {
    onSelectPlan: (planId: string) => void;
    onSkip: () => void;
}

export function PaywallScreen({ onSelectPlan, onSkip }: PaywallScreenProps) {
    const plans = [
        { id: 'monthly', title: 'Monthly Guardian', price: '$9.99', desc: 'Flexible protection' },
        { id: 'annual', title: 'Annual Guardian', price: '$89.99', desc: 'Best value (25% off)', popular: true },
    ];

    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900">
            {/* Mascot Intro */}
            <div className="flex items-center gap-4 mb-8">
                <GuardianMascot size={70} mood="happy" />
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg border border-blue-100 dark:border-gray-700"
                >
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                        Ready to start your journey? Let's pick a plan to keep your assets protected, {''}
                        <span className="text-blue-600">24/7</span>.
                    </p>
                </motion.div>
            </div>

            {/* Plans */}
            <div className="space-y-4 flex-1">
                {plans.map((plan) => (
                    <motion.button
                        key={plan.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelectPlan(plan.id)}
                        className={`w-full p-5 rounded-3xl border-2 text-left relative overflow-hidden transition-all ${
                            plan.popular 
                                ? 'border-blue-500 bg-white shadow-xl shadow-blue-500/10' 
                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800'
                        }`}
                    >
                        {plan.popular && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-2xl">
                                MOST POPULAR
                            </div>
                        )}
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">{plan.title}</h4>
                        <div className="text-2xl font-black text-blue-600 my-1">{plan.price}</div>
                        <p className="text-xs text-gray-500 font-bold">{plan.desc}</p>
                    </motion.button>
                ))}
            </div>

            {/* Testimonials */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-8 space-y-4"
            >
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                    Trusted by our Community
                </h5>
                <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <p className="text-xs text-gray-600 dark:text-gray-300 italic mb-2">
                            "The Islamic Finance strategy gave me peace of mind this quarter. My savings actually feel protected."
                        </p>
                        <p className="text-[10px] font-black text-gray-900 dark:text-white">— Aishah, Kenya</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <p className="text-xs text-gray-600 dark:text-gray-300 italic mb-2">
                            "Divi handles the macro research that I simply don't have time to monitor. Best $9 I spend."
                        </p>
                        <p className="text-[10px] font-black text-gray-900 dark:text-white">— Mateo, Argentina</p>
                    </div>
                </div>
            </motion.div>

            {/* Trust Elements */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-8 text-center space-y-4"
            >
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    ⭐ 4.9/5 Average User Rating
                </p>
                <button
                    onClick={onSkip}
                    className="w-full py-3 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
                >
                    Maybe later
                </button>
            </motion.div>
        </div>
    );
}
