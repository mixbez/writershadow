import { generateWithGroq } from './groq.js';
import { generateWithAnthropic } from './anthropic.js';
import { decryptKey } from '../crypto/keys.js';

export async function generateSuggestion(posts, user) {
  switch (user.ai_provider) {
    case 'groq': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateWithGroq(posts, apiKey);
    }
    case 'anthropic': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateWithAnthropic(posts, apiKey);
    }
    case 'paid': {
      // Используем ключ владельца + защита от инъекций
      return generateWithAnthropic(posts, process.env.ANTHROPIC_API_KEY, { safe: true });
    }
    default:
      throw new Error('AI provider not configured');
  }
}
