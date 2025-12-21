import { createRemoteJWKSet, jwtVerify } from 'jose';

// JWKS cache with 1 hour TTL
let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get JWKS from Ory (with caching)
 */
function getJWKS(issuerUrl) {
  const now = Date.now();

  // Return cached JWKS if still valid
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }

  // Create new JWKS getter
  const jwksUrl = `${issuerUrl}/.well-known/jwks.json`;
  jwksCache = createRemoteJWKSet(new URL(jwksUrl));
  jwksCacheExpiry = now + JWKS_CACHE_TTL;

  return jwksCache;
}

/**
 * Validate JWT token with Ory
 * Returns { valid: true, userId: string } or { valid: false, error: string }
 */
export async function validateToken(token, env) {
  try {
    const issuerUrl = env.ORY_ISSUER_URL;

    if (!issuerUrl) {
      throw new Error('ORY_ISSUER_URL not configured');
    }

    // Get JWKS
    const JWKS = getJWKS(issuerUrl);

    // Verify JWT
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: issuerUrl,
      audience: env.ORY_AUDIENCE, // optional, can be undefined
    });

    // Extract user ID from sub claim
    const userId = payload.sub;
    if (!userId) {
      return { valid: false, error: 'Missing sub claim in token' };
    }

    return { valid: true, userId, payload };

  } catch (error) {
    // JWT validation failed
    return { valid: false, error: error.message };
  }
}

/**
 * Authentication middleware for Cloudflare Workers
 * Returns { authenticated: true, userId: string } or { authenticated: false, response: Response }
 */
export async function authenticate(request, env) {
  // Skip auth in development mode (when ORY_ISSUER_URL not set)
  if (!env.ORY_ISSUER_URL) {
    return { authenticated: true, userId: 'learner_001' }; // Default dev user
  }

  // Extract token
  const token = extractToken(request);
  if (!token) {
    return {
      authenticated: false,
      response: new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="MCP Server", error="invalid_request"'
        }
      })
    };
  }

  // Validate token
  const result = await validateToken(token, env);
  if (!result.valid) {
    return {
      authenticated: false,
      response: new Response(JSON.stringify({ error: 'Invalid or expired token', details: result.error }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer realm="MCP Server", error="invalid_token", error_description="${result.error}"`
        }
      })
    };
  }

  return { authenticated: true, userId: result.userId };
}
