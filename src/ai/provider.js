import { generateWithGroq, generateTagsWithGroq, generateBridgeWithGroq } from './groq.js';
import { generateWithAnthropic, generateTagsWithAnthropic, generateBridgeWithAnthropic } from './anthropic.js';
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

export async function generateTags(draftText, user) {
  switch (user.ai_provider) {
    case 'groq': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateTagsWithGroq(draftText, apiKey);
    }
    case 'anthropic': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateTagsWithAnthropic(draftText, apiKey);
    }
    case 'paid': {
      return generateTagsWithAnthropic(draftText, process.env.ANTHROPIC_API_KEY, { safe: true });
    }
    default:
      throw new Error('AI provider not configured');
  }
}

export async function generateBridge(text1, text2, user) {
  switch (user.ai_provider) {
    case 'groq': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateBridgeWithGroq(text1, text2, apiKey);
    }
    case 'anthropic': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateBridgeWithAnthropic(text1, text2, apiKey);
    }
    case 'paid': {
      return generateBridgeWithAnthropic(text1, text2, process.env.ANTHROPIC_API_KEY, { safe: true });
    }
    default:
      throw new Error('AI provider not configured');
  }
}
