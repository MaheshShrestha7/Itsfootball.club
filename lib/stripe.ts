import Stripe from 'stripe';

let stripe: Stripe | null = null;

// Fetch-based client: the app runs on Cloudflare Workers, where Node's http module isn't available
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('your-')) return null;
  if (!stripe) stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  return stripe;
}

export { Stripe };
