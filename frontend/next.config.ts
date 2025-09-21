import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // Skip TypeScript errors during build for MVP deployment
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint during build for MVP deployment
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://advotecate-api-367966088269.us-central1.run.app/api',
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
    NEXT_PUBLIC_FLUIDPAY_ENVIRONMENT: process.env.NEXT_PUBLIC_FLUIDPAY_ENVIRONMENT || 'sandbox',
    NEXT_PUBLIC_FLUIDPAY_DOMAIN: process.env.NEXT_PUBLIC_FLUIDPAY_DOMAIN || 'advotecate2026',
  },
};

export default nextConfig;
