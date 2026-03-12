/**
 * Creates a fake Telegraf ctx for testing commands
 */
export function createMockCtx({ userId = 1847504, text = '', chatType = 'private' } = {}) {
  const replies = [];
  const edits = [];

  const ctx = {
    from: { id: userId, first_name: 'Test' },
    chat: { id: userId, type: chatType },
    message: { text, message_id: 1 },
    session: {},

    reply: async (text, opts) => {
      const msg = { message_id: replies.length + 100, text, opts };
      replies.push(msg);
      return msg;
    },
    editMessageText: async (text) => {
      edits.push(text);
    },
    telegram: {
      editMessageText: async (chatId, msgId, _, text) => {
        edits.push(text);
      },
    },
    answerCbQuery: async () => {},

    // Helpers for assertions
    _replies: replies,
    _edits: edits,
    lastReply: () => replies[replies.length - 1]?.text,
    lastReplyOpts: () => replies[replies.length - 1]?.opts,
    allReplies: () => replies.map(r => r.text),
  };

  return ctx;
}

/**
 * Standard Pro user mock
 */
export const mockProUser = {
  id: 1,
  telegram_user_id: 1847504,
  ai_provider: 'paid',
  subscription_status: 'active',
  demo_expires_at: null,
  ai_tags_enabled: true,
  bridge_enabled: false,
  reminder_time: '09:00',
  timezone: 'Europe/Moscow',
  evening_nudge_enabled: true,
  evening_nudge_time: '21:00',
  weekly_summary_enabled: false,
  blog_channel_id: '@testchannel',
  draft_group_id: null,
  reminder_enabled: true,
};

/**
 * Standard free user mock
 */
export const mockFreeUser = {
  ...mockProUser,
  ai_provider: 'groq',
  subscription_status: 'inactive',
  demo_expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(), // demo active
};
