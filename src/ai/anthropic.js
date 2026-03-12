import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt, buildTagsPrompt, buildBridgePrompt, buildCombinePrompt, buildAskPrompt } from './prompt.js';

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

export async function generateTagsWithAnthropic(text, apiKey, options = {}) {
  const client = new Anthropic({ apiKey });
  const messages = buildTagsPrompt(text, options);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 50,
    system: messages.system,
    messages: [{ role: 'user', content: messages.user }],
  });

  const content = response.content[0].text.trim();
  // Parse comma-separated tags
  return content.split(',').map(tag => tag.trim()).filter(tag => tag);
}

export async function generateBridgeWithAnthropic(text1, text2, apiKey, options = {}) {
  const client = new Anthropic({ apiKey });
  const messages = buildBridgePrompt(text1, text2, options);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system: messages.system,
    messages: [{ role: 'user', content: messages.user }],
  });

  return response.content[0].text.trim();
}

export async function generateCombineWithAnthropic(drafts, apiKey, options = {}) {
  const client = new Anthropic({ apiKey });
  const messages = buildCombinePrompt(drafts, options);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: messages.system,
    messages: [{ role: 'user', content: messages.user }],
  });

  return response.content[0].text.trim();
}

export async function generateAskWithAnthropic(posts, apiKey, options = {}) {
  const client = new Anthropic({ apiKey });
  const messages = buildAskPrompt(posts, options);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: messages.system,
    messages: [{ role: 'user', content: messages.user }],
  });

  return response.content[0].text.trim();
}
