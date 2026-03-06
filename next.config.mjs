/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'altleads.com',
          },
        ],
        destination: 'https://www.altleads.com/:path*',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
