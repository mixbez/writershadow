/**
 * Split text into chunks, respecting Telegram's 4096 character limit
 * Strategy: paragraphs → sentences → characters
 */
export function splitText(text, limit = 4096) {
  if (text.length <= limit) {
    return [text];
  }

  const chunks = [];
  const paragraphs = text.split('\n\n');

  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // If paragraph itself is > limit, split by sentences
    if (paragraph.length > limit) {
      // First, save current chunk if not empty
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }

      // Split paragraph by sentences
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length > limit) {
          if (sentenceChunk) {
            chunks.push(sentenceChunk.trim());
            sentenceChunk = '';
          }

          // If single sentence > limit, split by characters
          if (sentence.length > limit) {
            for (let i = 0; i < sentence.length; i += limit) {
              chunks.push(sentence.slice(i, i + limit));
            }
          } else {
            sentenceChunk = sentence;
          }
        } else {
          sentenceChunk += sentence;
        }
      }

      if (sentenceChunk) {
        chunks.push(sentenceChunk.trim());
      }
      continue;
    }

    // Try to add paragraph to current chunk
    if (currentChunk) {
      const combined = currentChunk + '\n\n' + paragraph;
      if (combined.length <= limit) {
        currentChunk = combined;
      } else {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      }
    } else {
      currentChunk = paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
