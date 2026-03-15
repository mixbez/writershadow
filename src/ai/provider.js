import { generateWithGroq, generateTagsWithGroq, generateBridgeWithGroq, generateCombineWithGroq, generateAskWithGroq, generateExpandWithGroq } from './groq.js';
import { generateWithAnthropic, generateTagsWithAnthropic, generateBridgeWithAnthropic, generateCombineWithAnthropic, generateAskWithAnthropic, generateExpandWithAnthropic } from './anthropic.js';
import { decryptKey } from '../crypto/keys.js';

export async function generateSuggestion(posts, user) {
  switch (user.ai_provider) {
    case 'groq': {
      // Use shared public Groq key from environment
      return generateWithGroq(posts, process.env.GROQ_API_KEY);
    }
    case 'anthropic': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateWithAnthropic(posts, apiKey);
    }
    case 'paid': {
      // Use owner's key for paid Pro users
      return generateWithAnthropic(posts, process.env.ANTHROPIC_API_KEY, { safe: true });
    }
    default:
      throw new Error('AI provider not configured');
  }
}

export async function generateTags(draftText, user) {
  switch (user.ai_provider) {
    case 'groq': {
      // Use shared public Groq key from environment
      return generateTagsWithGroq(draftText, process.env.GROQ_API_KEY);
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
      // Use shared public Groq key from environment
      return generateBridgeWithGroq(text1, text2, process.env.GROQ_API_KEY);
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

export async function generateCombine(drafts, user) {
  switch (user.ai_provider) {
    case 'groq': {
      return generateCombineWithGroq(drafts, process.env.GROQ_API_KEY);
    }
    case 'anthropic': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateCombineWithAnthropic(drafts, apiKey);
    }
    case 'paid': {
      return generateCombineWithAnthropic(drafts, process.env.ANTHROPIC_API_KEY, { safe: true });
    }
    default:
      throw new Error('AI provider not configured');
  }
}

export async function generateAsk(posts, user) {
  switch (user.ai_provider) {
    case 'groq': {
      return generateAskWithGroq(posts, process.env.GROQ_API_KEY);
    }
    case 'anthropic': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateAskWithAnthropic(posts, apiKey);
    }
    case 'paid': {
      return generateAskWithAnthropic(posts, process.env.ANTHROPIC_API_KEY, { safe: true });
    }
    default:
      throw new Error('AI provider not configured');
  }
}

export async function generateExpand(drafts, user) {
  switch (user.ai_provider) {
    case 'groq': {
      return generateExpandWithGroq(drafts, process.env.GROQ_API_KEY);
    }
    case 'anthropic': {
      const apiKey = decryptKey(user.ai_key_encrypted);
      return generateExpandWithAnthropic(drafts, apiKey);
    }
    case 'paid': {
      return generateExpandWithAnthropic(drafts, process.env.ANTHROPIC_API_KEY, { safe: true });
    }
    default:
      throw new Error('AI provider not configured');
  }
}
