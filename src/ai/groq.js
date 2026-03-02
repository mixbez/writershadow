import Groq from 'groq-sdk';
import { buildPrompt } from './prompt.js';

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
