import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt } from './prompt.js';

export async function generateWithAnthropic(posts, apiKey, options = {}) {
  const client = new Anthropic({ apiKey });
  const messages = buildPrompt(posts, options);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: messages.system,
    messages: [{ role: 'user', content: messages.user }],
  });

  return response.content[0].text;
}
