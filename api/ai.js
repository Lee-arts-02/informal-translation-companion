import { hostedCompletion, createRateLimit } from '../server/hosted-ai.js';

export const config = {maxDuration:60};
const allowed = createRateLimit();
let running = 0;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method === 'GET') return res.status(200).json({available:!!process.env.BOB_API_KEY,provider:'IBM Bob'});
  if (req.method !== 'POST') { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'}); }
  let origin;
  try { origin = new URL(req.headers.origin); } catch { return res.status(403).json({error:'Use AI from this website.'}); }
  if (origin.host !== req.headers.host || !['https:','http:'].includes(origin.protocol)) return res.status(403).json({error:'Use AI from this website.'});
  if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({error:'Use JSON input.'});
  if (running >= 2 || !allowed(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'))
    return res.status(429).json({error:'Please wait a moment before making another AI request.'});
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(body).length > 80000) throw new Error();
  } catch { return res.status(400).json({error:'Invalid or oversized input.'}); }
  running++;
  try { const response = await hostedCompletion(body); return res.status(response.status).json(response.body); }
  finally { running--; }
}
