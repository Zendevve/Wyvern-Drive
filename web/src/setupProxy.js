const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Dev-only proxy. The package.json string proxy bypasses requests whose
 * Accept header includes text/html (historyApiFallback serves index.html
 * for them), which breaks navigation-style API calls such as the OAuth
 * start endpoint (/api/auth/discord) — the "sign in" button would just
 * reload the SPA. Mounting an explicit proxy for /api and /s ahead of the
 * fallback fixes that. Not used in production builds.
 */
module.exports = function (app) {
  app.use(
    ['/api', '/s'],
    createProxyMiddleware({
      target: 'http://localhost:8080',
    })
  );
};
