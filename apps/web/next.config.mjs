import nextPwa from '@ducanh2912/next-pwa';
import { fileURLToPath } from 'node:url';

const withPWA = nextPwa({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
const vmHost = process.env.NEXT_PUBLIC_VM_HOST || '35.188.144.29';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
      { protocol: 'http', hostname: vmHost, port: '9000' },
    ],
  },
  turbopack: {
    root: workspaceRoot,
  },
};

export default withPWA(nextConfig);
