// This file is a placeholder required so Vercel can detect the serverless
// function before the build command runs.  It is overwritten at build time by:
//   pnpm --filter @workspace/api-server run build
// which bundles the full Express app into this file via esbuild.
export default function handler(_req, res) {
  res.status(503).json({ error: "Server not built yet" });
}
