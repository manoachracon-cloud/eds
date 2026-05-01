/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.estheticdiamonds.fr"
      },
      {
        protocol: "https",
        hostname: "estheticdiamonds.fr"
      }
    ]
  }
};

export default nextConfig;
