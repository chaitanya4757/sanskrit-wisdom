const LOW_CONFIDENCE_THRESHOLD = 0.55; // tune this after real testing

const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi'
};

function formatVerse(verse, language) {
  const translation = language === 'hi' && verse.translation_hi
    ? verse.translation_hi
    : verse.translation_en;

  return [
    `Chapter ${verse.chapter}, Verse ${verse.verse}`,
    `Sanskrit: ${verse.sanskrit}`,
    `Transliteration: ${verse.transliteration}`,    
    `Translation: ${translation}`
  ].join('\n');
}

function formatHistory(history) {
  if (!history || history.length === 0) return '';
  const lines = history.map(turn => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`);
  return `\nConversation so far:\n${lines.join('\n')}\n`;
}

function buildPrompt({ question, language = 'en', verses, history = [] }) {
  const languageName = LANGUAGE_NAMES[language] || 'English';
  const hasStrongMatch = verses.length > 0 && verses[0].similarityScore >= LOW_CONFIDENCE_THRESHOLD;

  const versesBlock = verses
    .map(v => formatVerse(v, language))
    .join('\n\n---\n\n');

  const groundingInstruction = hasStrongMatch
    ? `Base your answer primarily on the verses provided below. Reference the specific chapter and verse you're drawing from.`
    : `The verses below are only loosely related to the question — none are a strong match. Be honest about this: give brief, general encouragement, mention that you don't have a directly relevant verse for this specific situation, and avoid forcing a tenuous connection just to cite something.`;

  return `You are a thoughtful guide who shares wisdom from the Bhagavad Gita to help people navigate everyday life problems.

${groundingInstruction}

Never invent a verse, chapter number, or translation that isn't given to you below. If nothing fits well, say so honestly rather than stretching a weak match.

Respond in ${languageName}. Keep the tone warm and practical, not preachy or overly formal. Keep the answer reasonably concise (a few short paragraphs at most).
${formatHistory(history)}
Relevant verses:

${versesBlock || '(none found)'}

User's question: ${question}`;
}

module.exports = { buildPrompt, LOW_CONFIDENCE_THRESHOLD };