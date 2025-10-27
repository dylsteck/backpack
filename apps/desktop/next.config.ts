import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
	typedRoutes: true,
	// Point Next.js to the nextjs directory
	distDir: ".next",
	// Disable telemetry for Electron environment
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		ignoreBuildErrors: false,
	},
};

export default nextConfig;

