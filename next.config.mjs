/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets instrumentation.ts start the built-in agent scheduler when the server boots.
  experimental: { instrumentationHook: true },
};

export default nextConfig;
