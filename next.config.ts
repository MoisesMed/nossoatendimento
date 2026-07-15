import type { NextConfig } from 'next';

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
	? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
	: undefined;

const nextConfig: NextConfig = {
	images: {
		formats: ['image/avif', 'image/webp'],
		qualities: [55, 60, 75],
		domains: supabaseHostname ? [supabaseHostname] : [],
		remotePatterns: supabaseHostname
			? [
				{
					protocol: 'https',
					hostname: supabaseHostname,
					pathname: '/storage/v1/object/**',
				},
			]
			: [],
	},
};

export default nextConfig;
