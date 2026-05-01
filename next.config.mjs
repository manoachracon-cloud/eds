/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.estheticdiamonds.fr",
        pathname: "/ressources/images/**"
      }
    ]
  }
};

export default nextConfig;
