import { llmsTxt } from '@/lib/llms';

// Built once per deploy (see lib/llms.ts and docs/ai-seo.md)
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
