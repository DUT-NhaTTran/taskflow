/** @type {import('next').NextConfig} */
const nextConfig = {
    // Disable turbo/turbopack for stability
    experimental: {
        // Remove turbo setting as it's causing issues
    },
    // swcMinify is now enabled by default in Next.js 13+, remove it
    compress: true,
    
    // Optimize webpack for memory usage
    webpack: (config, { dev, isServer }) => {
        // Reduce memory usage during build
        if (!dev && !isServer) {
            config.optimization.splitChunks = {
                chunks: 'all',
                cacheGroups: {
                    default: false,
                    vendors: false,
                    // Vendor chunk
                    vendor: {
                        name: 'vendor',
                        chunks: 'all',
                        test: /node_modules/,
                        priority: 20
                    },
                    // Common chunk
                    common: {
                        name: 'common',
                        minChunks: 2,
                        chunks: 'all',
                        priority: 10
                    }
                }
            };
        }
        
        return config;
    },
    
    // Production optimizations
    poweredByHeader: false,
    generateEtags: false,
    
    env: {
        AI_SERVICE_URL: process.env.REACT_APP_AI_SERVICE_URL || 'http://localhost:8088',
        USER_SERVICE_URL: process.env.REACT_APP_USER_SERVICE_URL || 'http://localhost:8086',
        ACCOUNTS_SERVICE_URL: process.env.REACT_APP_ACCOUNTS_SERVICE_URL || 'http://localhost:8081',
        PROJECTS_SERVICE_URL: process.env.REACT_APP_PROJECTS_SERVICE_URL || 'http://localhost:8083',
        TASKS_SERVICE_URL: process.env.REACT_APP_TASKS_SERVICE_URL || 'http://localhost:8085',
        FILE_SERVICE_URL: process.env.REACT_APP_FILE_SERVICE_URL || 'http://localhost:8087',
        SPRINTS_SERVICE_URL: process.env.REACT_APP_SPRINTS_SERVICE_URL || 'http://localhost:8084',
        NOTIFICATIONS_SERVICE_URL: process.env.REACT_APP_NOTIFICATIONS_SERVICE_URL || 'http://localhost:8089',
    },
    
    async rewrites() {
        return [
            {
                source: '/api/attachments/:path*',
                destination: `${process.env.REACT_APP_FILE_SERVICE_URL || 'http://localhost:8087'}/api/attachments/:path*`,
            },
            {
                source: '/api/tasks/:path*',
                destination: `${process.env.REACT_APP_TASKS_SERVICE_URL || 'http://localhost:8085'}/api/tasks/:path*`,
            },
            {
                source: '/api/users/:path*',
                destination: `${process.env.REACT_APP_USER_SERVICE_URL || 'http://localhost:8086'}/api/users/:path*`,
            },
            {
                source: '/api/projects/:path*',
                destination: `${process.env.REACT_APP_PROJECTS_SERVICE_URL || 'http://localhost:8083'}/api/projects/:path*`,
            },
            {
                source: '/api/ai/:path*',
                destination: `${process.env.REACT_APP_AI_SERVICE_URL || 'http://localhost:8088'}/api/:path*`,
            },

            {
                source: '/api/projects/:path*',
                destination: 'http://localhost:8083/api/projects/:path*',
            },
            {
                source: '/api/tasks/:path*',
                destination: 'http://localhost:8085/api/tasks/:path*',
            }
        ];
    },
}

module.exports = nextConfig
