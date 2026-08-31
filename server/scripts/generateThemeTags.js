require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const VERSES_PATH = path.resolve(__dirname, '../data/verses.json');
const GENERATION_MODEL = 'gemini-3.5-flash-lite';
//const GENERATION_MODEL = 'gemini-3.6-flash';
const BATCH_SIZE = 25; // verses per prompt — keeps each response small enough to parse reliably

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function buildPrompt(batch) {
  const verseList = batch.map(v =>
    `${v.chapter}.${v.verse}: ${v.translation_en}`
  ).join('\n');

  return `You are tagging verses from the Bhagavad Gita for a search system. For each verse below, identify the UNDERLYING real-life situation or dilemma the verse speaks to — NOT a literal description of what the verse's words say.

Important: many verses describe physical symptoms, narrative action, or a character's literal words (e.g. "his hands trembled", "he said in despair"). Do NOT tag the literal physical description. Instead, infer and tag the surrounding SITUATION that would cause someone to feel or say that — for example, a verse about trembling hands and a dry mouth before a war against one's own family should be tagged with the underlying situation ("being forced into conflict with someone you love", "having no choice in an impossible situation", "dread before an irreversible decision"), not the symptom itself ("trembling", "anxiety symptoms").

Think like a search engine: what would a modern person type into a search bar when facing this situation, that this verse's WISDOM (not its literal plot) could speak to?

Respond with ONLY a JSON array, no other text, no markdown code fences. Each element:
{"chapter": <number>, "verse": <number>, "themes": ["theme1", "theme2", "theme3"]}

Verses:
${verseList}`;
}

function parseResponse(text) {
  // Strip markdown code fences if the model added them despite instructions
  const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

async function tagBatch(batch, retriesLeft = 2) {
  try {
    const result = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildPrompt(batch)
    });
    return parseResponse(result.text);
  } catch (err) {
    if (retriesLeft > 0) {
      console.warn(`Batch failed (${err.message}), retrying... (${retriesLeft} left)`);
      await new Promise(r => setTimeout(r, 2000));
      return tagBatch(batch, retriesLeft - 1);
    }
    throw err;
  }
}

async function main() {
    const verses = JSON.parse(fs.readFileSync(VERSES_PATH, 'utf-8'));

    // Skip verses that already have real theme_tags from a previous run
    const FORCE_RETAG = false; // set back to false after this one-time full re-run
    const remaining = FORCE_RETAG ? verses : verses.filter(v => !v.theme_tags || v.theme_tags.length === 0);
    console.log(`Loaded ${verses.length} verses. ${verses.length - remaining.length} already tagged — skipping those. ${remaining.length} remaining.`);

    const batches = chunk(remaining, BATCH_SIZE);

  // Build a lookup for quick merging
  const versesByKey = {};
  for (const v of verses) versesByKey[`${v.chapter}.${v.verse}`] = v;

  let taggedCount = 0;

  for (let i = 0; i < batches.length; i++) {
    try {
      const tags = await tagBatch(batches[i]);
      for (const entry of tags) {
        const key = `${entry.chapter}.${entry.verse}`;
        if (versesByKey[key]) {
          versesByKey[key].theme_tags = entry.themes;
          taggedCount++;
        }
      }
      console.log(`Batch ${i + 1}/${batches.length} done (${taggedCount}/${verses.length} tagged so far)`);
    } catch (err) {
      console.error(`Batch ${i + 1} permanently failed: ${err.message} — those verses will keep empty theme_tags.`);
    }
    await new Promise(r => setTimeout(r, 500)); // small courtesy pause between batches
  }

  fs.writeFileSync(VERSES_PATH, JSON.stringify(verses, null, 2), 'utf-8');
  console.log(`\nDone. Tagged ${taggedCount}/${verses.length} verses. Wrote updated ${VERSES_PATH}`);
}

main();