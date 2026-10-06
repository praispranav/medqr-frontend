/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A second local dev server (e.g. a preview on another port) needs its own build folder, or the
  // two overwrite each other's .next. Unset = the normal .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

module.exports = nextConfig;
