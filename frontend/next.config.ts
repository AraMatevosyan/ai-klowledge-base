import type {
    NextConfig,
} from 'next';

const backendUrl =
    process.env.BACKEND_URL ??
    'http://localhost:3001';

const isVercel =
    process.env.VERCEL === '1';

const nextConfig: NextConfig = {
    output: isVercel
        ? undefined
        : 'standalone',

    async rewrites() {
        return [
            {
                source:
                    '/api/:path*',

                destination:
                    `${backendUrl}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
