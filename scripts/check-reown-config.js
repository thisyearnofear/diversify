#!/usr/bin/env node

/**
 * Diagnostic script to check Reown AppKit configuration
 * Run with: node scripts/check-reown-config.js
 */

const fs = require("fs");
const path = require("path");

// Simple .env parser
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const env = {};

  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  });

  return env;
}

const env = loadEnv();
const projectId =
  env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
  env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
const appUrl =
  env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

console.log("\n🔍 Reown AppKit Configuration Check\n");
console.log("━".repeat(50));

// Check 1: Project ID
if (!projectId) {
  console.log("❌ NEXT_PUBLIC_REOWN_PROJECT_ID is not set");
  console.log("   → Get one at: https://cloud.reown.com/");
  process.exit(1);
} else {
  console.log(
    `✅ Project ID found: ${projectId.substring(0, 8)}...${projectId.substring(projectId.length - 4)}`,
  );
}

// Check 2: Feature flags
const appkitWeb = env.NEXT_PUBLIC_ENABLE_APPKIT_WALLET !== "false";
const appkitEmail = env.NEXT_PUBLIC_ENABLE_APPKIT_EMAIL !== "false";
const appkitSocials = env.NEXT_PUBLIC_ENABLE_APPKIT_SOCIALS !== "false";

console.log("\n📋 Feature Flags:");
console.log(`   AppKit Web: ${appkitWeb ? "✅ Enabled" : "❌ Disabled"}`);
console.log(`   Email Login: ${appkitEmail ? "✅ Enabled" : "❌ Disabled"}`);
console.log(`   Social Login: ${appkitSocials ? "✅ Enabled" : "❌ Disabled"}`);

// Check 3: App URL
console.log(`\n🌐 App URL: ${appUrl}`);

// Instructions
console.log("\n📝 Required Reown Dashboard Configuration:");
console.log("━".repeat(50));
console.log("1. Go to: https://cloud.reown.com/");
console.log("2. Select your project");
console.log("3. Verify these settings:");
console.log("   ");
console.log('   ✓ Project Type: Must be "App" (NOT "Wallet")');
console.log("   ✓ Allowed Domains:");
console.log("     - http://localhost:3042");
console.log("     - https://diversifiapp.vercel.app");
console.log("     - https://*.vercel.app (for preview deployments)");
console.log("     - Your production domain");
console.log("   ");
console.log("   ✓ Features Enabled:");
console.log("     - Email Login: ON");
console.log("     - Social Login: ON");
console.log("     - Analytics: Optional");
console.log("");
console.log("━".repeat(50));
console.log("\n⚠️  Common Issues:");
console.log('   • "CancelledError" → Wrong project type or missing domain');
console.log('   • "Timeout" → Check network/firewall settings');
console.log('   • "Double init" → Clear browser cache and restart dev server');
console.log("");
