/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // better-sqlite3 is a native module — let Node require it directly instead
    // of letting webpack try (and fail) to bundle it.
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
