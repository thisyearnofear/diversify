#!/usr/bin/env node

/**
 * Mobile Optimization Analysis Script
 * Evaluates how well the app is optimized for mobile and mini app environments
 */

const fs = require('fs');

console.log('🔍 Starting Mobile Optimization Analysis...\n');

// Analysis criteria
const criteria = {
  viewport: { score: 0, max: 10, details: [] },
  touchTargets: { score: 0, max: 10, details: [] },
  responsiveDesign: { score: 0, max: 10, details: [] },
  performance: { score: 0, max: 10, details: [] },
  accessibility: { score: 0, max: 10, details: [] },
  miniAppSpecific: { score: 0, max: 10, details: [] }
};

// 1. Viewport Configuration Analysis
console.log('1️⃣ Analyzing Viewport Configuration...');
try {
  const indexContent = fs.readFileSync('pages/index.tsx', 'utf8');
  
  if (indexContent.includes('name="viewport"')) {
    criteria.viewport.score += 2;
    criteria.viewport.details.push('✅ Viewport meta tag present');
  }
  
  if (indexContent.includes('width=device-width')) {
    criteria.viewport.score += 2;
    criteria.viewport.details.push('✅ Device width configuration');
  }
  
  if (indexContent.includes('initial-scale=1.0')) {
    criteria.viewport.score += 2;
    criteria.viewport.details.push('✅ Initial scale set to 1.0');
  }
  
  if (indexContent.includes('user-scalable=no')) {
    criteria.viewport.score += 2;
    criteria.viewport.details.push('✅ User scaling disabled (good for mini apps)');
  }
  
  if (indexContent.includes('maximum-scale=1.0')) {
    criteria.viewport.score += 2;
    criteria.viewport.details.push('✅ Maximum scale limited');
  }
  
} catch (error) {
  criteria.viewport.details.push('❌ Error analyzing viewport');
}

// 2. Touch Targets Analysis
console.log('\n2️⃣ Analyzing Touch Targets...');
try {
  const walletButtonContent = fs.readFileSync('components/WalletButton.tsx', 'utf8');
  
  // Check button padding
  if (walletButtonContent.includes('px-4') || walletButtonContent.includes('px-5')) {
    criteria.touchTargets.score += 3;
    criteria.touchTargets.details.push('✅ Horizontal padding ≥ 1rem (px-4/5)');
  }
  
  if (walletButtonContent.includes('py-2') || walletButtonContent.includes('py-3')) {
    criteria.touchTargets.score += 3;
    criteria.touchTargets.details.push('✅ Vertical padding ≥ 0.5rem (py-2/3)');
  }
  
  // Check minimum touch area (48x48px recommended)
  if (walletButtonContent.includes('min-w-') || walletButtonContent.includes('min-h-')) {
    criteria.touchTargets.score += 2;
    criteria.touchTargets.details.push('✅ Minimum dimensions specified');
  }
  
  // Check for adequate spacing
  if (walletButtonContent.includes('gap-') || walletButtonContent.includes('space-')) {
    criteria.touchTargets.score += 2;
    criteria.touchTargets.details.push('✅ Proper spacing between elements');
  }
  
} catch (error) {
  criteria.touchTargets.details.push('❌ Error analyzing touch targets');
}

// 3. Responsive Design Analysis
console.log('\n3️⃣ Analyzing Responsive Design...');
try {
  const globalsContent = fs.readFileSync('styles/globals.css', 'utf8');
  const tailwindConfig = fs.readFileSync('tailwind.config.js', 'utf8');
  const indexContent = fs.readFileSync('pages/index.tsx', 'utf8');
  
  // Check for responsive breakpoints
  if (globalsContent.includes('@media') || tailwindConfig.includes('screens')) {
    criteria.responsiveDesign.score += 3;
    criteria.responsiveDesign.details.push('✅ Responsive breakpoints defined');
  }
  
  // Check for mobile-first approach
  if (globalsContent.includes('Mobile-first') || indexContent.includes('max-w-md')) {
    criteria.responsiveDesign.score += 3;
    criteria.responsiveDesign.details.push('✅ Mobile-first design approach');
  }
  
  // Check container sizing
  if (indexContent.includes('max-w-md') || indexContent.includes('max-w-sm')) {
    criteria.responsiveDesign.score += 2;
    criteria.responsiveDesign.details.push('✅ Appropriate max-width for mobile');
  }
  
  // Check flexible layouts
  if (indexContent.includes('flex') || indexContent.includes('grid')) {
    criteria.responsiveDesign.score += 2;
    criteria.responsiveDesign.details.push('✅ Flexible layout system used');
  }
  
} catch (error) {
  criteria.responsiveDesign.details.push('❌ Error analyzing responsive design');
}

// 4. Performance Optimization Analysis
console.log('\n4️⃣ Analyzing Performance Optimization...');
try {
  const indexContent = fs.readFileSync('pages/index.tsx', 'utf8');
  
  // Check for lazy loading
  if (indexContent.includes('lazy') || indexContent.includes('loading="lazy"')) {
    criteria.performance.score += 3;
    criteria.performance.details.push('✅ Lazy loading implemented');
  }
  
  // Check for code splitting
  if (indexContent.includes('dynamic') || indexContent.includes('React.lazy')) {
    criteria.performance.score += 3;
    criteria.performance.details.push('✅ Code splitting used');
  }
  
  // Check for optimized images
  if (indexContent.includes('next/image') || indexContent.includes('Image')) {
    criteria.performance.score += 2;
    criteria.performance.details.push('✅ Optimized image components');
  }
  
  // Check for conditional loading
  if (indexContent.includes('isLoading') || indexContent.includes('useMemo')) {
    criteria.performance.score += 2;
    criteria.performance.details.push('✅ Conditional loading patterns');
  }
  
} catch (error) {
  criteria.performance.details.push('❌ Error analyzing performance');
}

// 5. Accessibility Analysis
console.log('\n5️⃣ Analyzing Accessibility...');
try {
  const walletButtonContent = fs.readFileSync('components/WalletButton.tsx', 'utf8');
  const indexContent = fs.readFileSync('pages/index.tsx', 'utf8');
  
  // Check for semantic HTML
  if (walletButtonContent.includes('button') && !walletButtonContent.includes('div[role="button"]')) {
    criteria.accessibility.score += 3;
    criteria.accessibility.details.push('✅ Proper button elements used');
  }
  
  // Check for ARIA attributes
  if (walletButtonContent.includes('aria-') || indexContent.includes('aria-')) {
    criteria.accessibility.score += 3;
    criteria.accessibility.details.push('✅ ARIA attributes present');
  }
  
  // Check for keyboard navigation
  if (walletButtonContent.includes('onKeyDown') || walletButtonContent.includes('tabIndex')) {
    criteria.accessibility.score += 2;
    criteria.accessibility.details.push('✅ Keyboard navigation support');
  }
  
  // Check for sufficient contrast
  if (indexContent.includes('dark:') || indexContent.includes('text-gray-900')) {
    criteria.accessibility.score += 2;
    criteria.accessibility.details.push('✅ Color contrast considerations');
  }
  
} catch (error) {
  criteria.accessibility.details.push('❌ Error analyzing accessibility');
}

// 6. Mini App Specific Optimization Analysis
console.log('\n6️⃣ Analyzing Mini App Specific Optimizations...');
try {
  const indexContent = fs.readFileSync('pages/index.tsx', 'utf8');
  const walletButtonContent = fs.readFileSync('components/WalletButton.tsx', 'utf8');
  
  // Check for mini app detection
  if (indexContent.includes('isMiniPay') || indexContent.includes('isFarcaster')) {
    criteria.miniAppSpecific.score += 3;
    criteria.miniAppSpecific.details.push('✅ Mini app environment detection');
  }
  
  // Check for iframe compatibility
  if (indexContent.includes('inIframe') || indexContent.includes('window !== window.parent')) {
    criteria.miniAppSpecific.score += 3;
    criteria.miniAppSpecific.details.push('✅ Iframe compatibility handling');
  }
  
  // Check for mobile app meta tags
  if (indexContent.includes('mobile-web-app-capable') || indexContent.includes('apple-mobile-web-app-capable')) {
    criteria.miniAppSpecific.score += 2;
    criteria.miniAppSpecific.details.push('✅ Mobile app meta tags present');
  }
  
  // Check for touch-friendly interactions
  if (walletButtonContent.includes('whileTap') || walletButtonContent.includes('hover:')) {
    criteria.miniAppSpecific.score += 2;
    criteria.miniAppSpecific.details.push('✅ Touch-friendly interaction patterns');
  }
  
} catch (error) {
  criteria.miniAppSpecific.details.push('❌ Error analyzing mini app optimizations');
}

// Calculate total score
console.log('\n📊 SCORING RESULTS:');
console.log('==================');

let totalScore = 0;
let totalMax = 0;

Object.keys(criteria).forEach(key => {
  const category = criteria[key];
  totalScore += category.score;
  totalMax += category.max;
  
  console.log(`\n${key.replace(/([A-Z])/g, ' $1').toUpperCase()}:`);
  console.log(`  Score: ${category.score}/${category.max}`);
  category.details.forEach(detail => console.log(`  ${detail}`));
});

const percentage = Math.round((totalScore / totalMax) * 100);

console.log(`\n🎯 OVERALL MOBILE OPTIMIZATION SCORE: ${totalScore}/${totalMax} (${percentage}%)`);

// Rate the optimization
let rating = '';
let emoji = '';
let color = '';

if (percentage >= 90) {
  rating = 'EXCELLENT';
  emoji = '🌟';
  color = '32CD32'; // Green
} else if (percentage >= 80) {
  rating = 'VERY GOOD';
  emoji = '👍';
  color = '90EE90'; // Light Green
} else if (percentage >= 70) {
  rating = 'GOOD';
  emoji = '😊';
  color = 'FFA500'; // Orange
} else if (percentage >= 60) {
  rating = 'FAIR';
  emoji = '🤔';
  color = 'FF8C00'; // Dark Orange
} else {
  rating = 'NEEDS IMPROVEMENT';
  emoji = '⚠️';
  color = 'FF0000'; // Red
}

console.log(`\n🏆 RATING: \x1b[38;5;${color}m${rating} ${emoji}\x1b[0m`);

// Detailed recommendations
console.log('\n💡 RECOMMENDATIONS:');
console.log('==================');

if (criteria.viewport.score < criteria.viewport.max) {
  console.log('- Consider adding viewport-fit=cover for notch support');
  console.log('- Test different initial-scale values for optimal rendering');
}

if (criteria.touchTargets.score < criteria.touchTargets.max) {
  console.log('- Ensure all interactive elements have minimum 48x48px touch area');
  console.log('- Add min-w-[48px] min-h-[48px] to critical buttons');
  console.log('- Increase spacing between interactive elements');
}

if (criteria.responsiveDesign.score < criteria.responsiveDesign.max) {
  console.log('- Add more responsive breakpoints for different device sizes');
  console.log('- Test on various screen sizes (320px to 480px width)');
  console.log('- Consider using container queries for component-level responsiveness');
}

if (criteria.performance.score < criteria.performance.max) {
  console.log('- Implement lazy loading for non-critical components');
  console.log('- Optimize bundle size for faster initial load');
  console.log('- Use Next.js Image component for automatic optimization');
}

if (criteria.accessibility.score < criteria.accessibility.max) {
  console.log('- Add ARIA labels for interactive elements');
  console.log('- Ensure sufficient color contrast (4.5:1 minimum)');
  console.log('- Test keyboard navigation and focus states');
}

if (criteria.miniAppSpecific.score < criteria.miniAppSpecific.max) {
  console.log('- Add specific optimizations for MiniPay iframe environment');
  console.log('- Test in various mini app containers (MiniPay, Farcaster, etc.)');
  console.log('- Consider adding mini app-specific error handling');
}

console.log('\n🎯 MINI APP ENVIRONMENT SPECIFIC RECOMMENDATIONS:');
console.log('- Test in actual MiniPay and Farcaster environments');
console.log('- Verify touch interactions work well in iframe contexts');
console.log('- Check that all UI elements are visible and usable in constrained spaces');
console.log('- Test performance in low-memory mobile devices');
console.log('- Ensure the app works well in both portrait and landscape orientations');

console.log('\n✅ Mobile optimization analysis complete!');