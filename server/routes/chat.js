const express = require('express');
const router = express.Router();

//const { embedText, generate } = require('../services/gemini');
const { embedText } = require('../services/cohereEmbeddings');
const { generate } = require('../services/gemini');
const { search } = require('../services/retrieval');
const { buildPrompt, LOW_CONFIDENCE_THRESHOLD } = require('../services/promptBuilder');

const TOP_K = 3;

router.post('/chat', async (req, res) => {
  try {
    const { message, language, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'A non-empty "message" field is required.' });
    }

    const SUPPORTED_LANGUAGES = ['en', 'hi', 'es', 'de'];
    const safeLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
    const safeHistory = Array.isArray(history) ? history : [];

    // 1. Embed the user's question
    const queryVector = await embedText(message);

    // 2. Retrieve the most relevant verses
    const verses = search(queryVector, TOP_K);
    console.log('DEBUG top scores:', verses.map(v => `${v.chapter}.${v.verse}: ${v.similarityScore.toFixed(3)}`));

    // 3. Build the grounded prompt
    const prompt = buildPrompt({
      question: message,
      language: safeLanguage,
      verses,
      history: safeHistory
    });

    // 4. Generate the final answer
    const answer = await generate(prompt);

    // 5. Respond with answer + citations
        // Only include citations if there's actually a strong match
    const hasStrongMatch = verses.length > 0 && verses[0].similarityScore >= LOW_CONFIDENCE_THRESHOLD;
    const citationsToReturn = hasStrongMatch ? verses : [];

    res.json({
      answer,
      citations: citationsToReturn.map(v => ({
        source: v.source,
        chapter: v.chapter,
        verse: v.verse,
        translation: safeLanguage === 'hi' && v.translation_hi ? v.translation_hi : v.translation_en,
        similarityScore: v.similarityScore
      }))
    });

  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: 'Something went wrong generating a response. Please try again.' });
  }
});

module.exports = router;