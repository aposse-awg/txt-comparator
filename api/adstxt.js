// Vercel serverless function for /api/adstxt; the logic lives in adstxt-proxy.js
// so local dev and production behave the same.
import { handleAdsTxtRequest } from '../adstxt-proxy.js'

// One request can take up to two 15s attempts (https, then http).
export const config = { maxDuration: 60 }

export default handleAdsTxtRequest
