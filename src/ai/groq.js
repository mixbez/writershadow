import Groq from 'groq-sdk';
import { buildPrompt, buildTagsPrompt, buildBridgePrompt, buildAskPrompt } from './prompt.js';

export async function generateWithGroq(posts, apiKey) {
  const client = new Groq({ apiKey });
  const messages = buildPrompt(posts, { safe: false });

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 500,
    messages: [
      { role: 'system', content: messages.system },
      { role: 'user', content: messages.user },
    ],
  });

  return response.choices[0].message.content;
}

export async function generateTagsWithGroq(text, apiKey) {
  const client = new Groq({ apiKey });
  const messages = buildTagsPrompt(text, { safe: false });

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 50,
    messages: [
      { role: 'system', content: messages.system },
      { role: 'user', content: messages.user },
    ],
  });

  const content = response.choices[0].message.content.trim();
  // Parse comma-separated tags
  return content.split(',').map(tag => tag.trim()).filter(tag => tag);
}

export async function generateBridgeWithGroq(text1, text2, apiKey) {
  const client = new Groq({ apiKey });
  const messages = buildBridgePrompt(text1, text2, { safe: false });

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 100,
    messages: [
      { role: 'system', content: messages.system },
      { role: 'user', content: messages.user },
    ],
  });

  return response.choices[0].message.content.trim();
}

export async function generateAskWithGroq(posts, apiKey) {
  const client = new Groq({ apiKey });
  const messages = buildAskPrompt(posts, { safe: false });

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 400,
    messages: [
      { role: 'system', content: messages.system },
      { role: 'user', content: messages.user },
    ],
  });

  return response.choices[0].message.content.trim();
}
