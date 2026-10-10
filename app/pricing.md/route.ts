import { pricingMarkdown } from '@/lib/llms';

// Built once per deploy (see lib/llms.ts and docs/ai-seo.md)
export const dynamic = 'force-static';

export function GET() {
  return new Response(pricingMarkdown(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
