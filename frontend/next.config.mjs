/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/architecture/**',
      },
    ],
  },
  // Silence the "webpack config with Turbopack" warning by declaring an
  // empty turbopack config — we have nothing to configure here.
  turbopack: {},
};

export default nextConfig;
