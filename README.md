# Gita Guidance — A RAG-Based Life Wisdom Chatbot

A live, multilingual chatbot that answers everyday life questions — anxiety, duty, decisions, grief, purpose — by retrieving and reasoning over verses from the Bhagavad Gita, using a Retrieval-Augmented Generation (RAG) pipeline.

**Live app:** https://sanskrit-wisdom.onrender.com/
**Repo:** https://github.com/chaitanya4757/sanskrit-wisdom
---

## Problem Statement (as I understood it)

Build a system that helps people navigate everyday life problems — decisions, anxiety, grief, purpose, duty — by drawing on wisdom from ancient Sanskrit literature, and package it as a working, shareable product rather than a proof-of-concept. The brief was given verbally and intentionally open-ended, so part of this assignment was making the scoping decisions myself: which text(s) to source, how to structure and retrieve from them meaningfully (rather than just keyword-matching or hardcoding responses), which languages to support, and how to get it into someone else's hands as a live product, not just code on a laptop. The technical approach below — and the tradeoffs I made along the way — reflect those decisions and the reasoning behind them.

---

## What it does

A user asks a question in plain language, in one of four supported languages (English, Hindi, Spanish, German). The system:

1. Embeds the question into a vector representation.
2. Retrieves the most semantically relevant verses from a 701-verse Bhagavad Gita corpus using cosine similarity — no keyword matching, no hardcoded responses.
3. Builds a grounded prompt containing only the retrieved verses.
4. Generates a natural-language answer in the requested language, citing the actual verses used.
5. If nothing retrieved is a genuinely strong match, the system says so honestly rather than forcing a weak or misleading citation.

---

## Architecture

```
User question (any of 4 languages)
        │
        ▼
  Embed query (Cohere embed-multilingual-v3.0)
        │
        ▼
  Cosine similarity search against 701 pre-embedded verses
  (in-memory, no vector database)
        │
        ▼
  Confidence check — is the top match's similarity score ≥ 0.55?
        │
   ┌────┴────┐
  Yes        No
   │          │
   ▼          ▼
Build prompt with     Build prompt instructing
retrieved verses,     an honest "no strong match"
instruct citation     response, no citations
   │          │
   └────┬─────┘
        ▼
  Generate answer (Gemini 3.5 Flash Lite)
        │
        ▼
  Return { answer, citations[] } to the frontend
```

**Single deployment, not split services.** One Express server (`server/`) serves both the REST API (`/api/chat`) and the built React frontend (`client/`) as static files — one Render Web Service, one URL, no CORS configuration needed in production, no separate hosting to manage.

**No vector database.** At ~700 verses, a dedicated vector DB (Pinecone, Weaviate, etc.) is unnecessary infrastructure. Embeddings are precomputed once and stored as a static JSON file (`server/data/embeddings.json`); cosine similarity is computed in-memory per request in plain JavaScript. This removes an entire piece of infrastructure, a signup, and a failure point, with no meaningful latency cost at this corpus size.

---

## Content sourcing

- **Source:** [`samanyougarg/gita`](https://github.com/samanyougarg/gita) — a public dataset of the Bhagavad Gita in JSON, licensed under **Unlicense** (public-domain equivalent — no attribution or usage restrictions).
- **Structure:** the source data is relational (separate `verse.json` and `translation.json` files joined by `verse_id`, with 21 different translators available per verse). A one-time transform script (`server/scripts/transformGitaData.js`) joins and flattens this into a single, consistent schema.
- **Translators chosen:** Swami Adidevananda for English, Swami Ramsukhdas for Hindi — selected because both have complete 701/701 verse coverage with no gaps, ensuring consistent tone throughout rather than mixing translation styles verse-to-verse.

---

## Multilingual support

Four languages are supported: **English, Hindi, Spanish, German.**

The mechanism is deliberately simple: retrieval always happens against the English-embedded corpus (semantic meaning transfers across languages at the embedding level), and the **generation model produces the final answer text in whichever language the user explicitly selects** via the UI dropdown. This is not automatic language detection of the input — the dropdown selection is authoritative — a deliberate v1 simplification that trades a small amount of flexibility for predictability and zero detection-accuracy risk.

Adding a language is a **small, three-file config change, not an architectural change**:
1. Add the language name to `LANGUAGE_NAMES` in `server/services/promptBuilder.js`
2. Add the language code to `SUPPORTED_LANGUAGES` in `server/routes/chat.js`
3. Add an `<option>` to `client/src/components/LanguageSelector.jsx`

**Known, deliberate limitation:** authentic source-verse translations (by named scholars) only exist for English and Hindi in the dataset used. For Spanish and German, the surrounding explanation is generated in the target language, but the cited verse text itself is shown in English — this was a deliberate choice to preserve translation authenticity rather than having the model re-translate the sacred text on the fly, which would introduce translation drift into the one part of the response that should be exact.

Both the "confident citation" and "honest no-match" response paths were tested and validated in all four languages.

---

## Key decisions and pivots

Building this surfaced several real technical constraints that shaped the final architecture. Documenting them here because the reasoning behind each pivot is arguably more informative than the end state alone.

### 1. Embedding provider: Gemini → Cohere

The original plan used Google's Gemini API for both embeddings and generation, for stack consistency. During the one-time corpus-embedding step, two issues surfaced:
- `gemini-embedding-001` does not support batching multiple texts in a single API call (confirmed via Google's own documentation) — meaning embedding 701 verses requires 701 separate requests.
- Gemini's free tier imposes both per-minute (100/min) and per-day (1000/day) request caps on embeddings, which — combined with the lack of batching — made a one-time corpus build a fragile, multi-hour process prone to quota exhaustion.

**Switched to Cohere's embed API**, which supports up to 96 texts per request. The entire 701-verse corpus embeds in **8 API calls instead of 701**, sidestepping the rate-limit problem structurally rather than by waiting it out. Cohere trial keys also don't require billing setup.

The original Gemini-based embedding script (`server/scripts/buildEmbeddings.js`) is kept in the repository, unused, as a record of this evaluation and pivot — see it alongside the Cohere version (`server/scripts/buildEmbeddings.cohere.js`) that replaced it. Gemini remains in use for the *generation* step (`server/services/gemini.js`) — only the embedding provider changed.

### 2. Generation model retirement, mid-project

`gemini-2.5-flash` (the initial generation model choice) returned a 404 mid-build: *"This model is no longer available to new users."* Google had retired it. Switched to `gemini-3.6-flash`.

### 3. A second, more consequential quota wall — and why the final model choice matters

`gemini-3.6-flash`'s free tier turned out to allow only **20 generation requests per day** — discovered while running a batch content-enrichment job, but this quota is shared with the *live deployed chat's* answer-generation step. This meant the deployed app itself risked failing after roughly 20 real messages in a day, including testing traffic.

Checked Google AI Studio's actual per-model quota dashboard directly (search results on this topic were inconsistent across sources and not trustworthy) and found `gemini-3.5-flash-lite` offers **500 requests/day** — 25x more headroom, fully sufficient for both development iteration and live demo traffic. **Final generation model: `gemini-3.5-flash-lite`.**

### 4. Confidence threshold calibration

To avoid the system confidently citing a verse that isn't genuinely relevant, retrieval results are compared against a similarity-score threshold before being used in the prompt or shown as citations. The initial threshold (0.65) was an unvalidated guess. Real testing showed:
- Off-topic/weak matches score in the ~0.43–0.45 range
- Strong, clearly relevant matches score in the ~0.64–0.70 range

The original 0.65 threshold sat *on top of* genuinely good matches, causing the system to incorrectly hedge on questions it should have confidently answered. **Recalibrated to 0.55**, sitting cleanly between the two observed clusters. This is a real, tested-against-data decision, not an arbitrary number — and a deliberate bias toward caution: in a wisdom/guidance context, an honest "I don't have a good match" is a better failure mode than a confident but weakly-grounded citation.

### 5. Content enrichment via theme tagging — a genuine retrieval quality improvement, with an honestly documented limit

Testing surfaced a real retrieval quality issue: the question *"what if your friend is on the other side of the battlefield, not by choice"* — essentially the Gita's own founding premise (Arjuna's dilemma, chapters 1:28–30) — scored too low to be cited. The literal verse translations describe physical symptoms of distress ("my limbs weaken," "my bow slips from my hand") using vocabulary that doesn't semantically overlap with a modern rephrasing of the same underlying situation.

**Fix:** a one-time batch job (`server/scripts/generateThemeTags.js`) asks Gemini to tag each verse with 2–3 modern life-situation themes, which are then included in the text that gets embedded. This closes the vocabulary gap between ancient translations and modern question phrasing.

**Result, validated with real before/after data:** on questions the corpus genuinely addresses well, theme-tagging measurably improved retrieval — e.g. the "duty without attachment" test question's top match improved from 0.647 to 0.684, and surfaced a new, highly relevant verse (6:1) that hadn't scored high enough to appear before. **On the original battlefield-friend question, however, scores barely moved (0.461 → 0.466).**

Diagnosing *why* led to an important distinction: that specific question is a **compound, specific scenario** (friend + opposing side + involuntary/lack of choice) that no single verse actually addresses at that level of nuance — the Gita's verses are written from Arjuna's first-person perspective about his own anguish, not as a general meditation on people forced into conflict against their will. This is a **content-depth limitation** — a boundary of what a single 701-verse text can speak to — not a fixable retrieval or tagging problem. It's structurally different from the vocabulary-gap problem theme-tagging is actually good at solving.

The system's honest "I don't have a good match for this" response in this case is the guardrail working correctly, not a failure. Expanding the corpus with texts more directly suited to specific themes — e.g. **Patanjali's Yoga Sutras** for meditation/mental discipline, or the **Chanakya Niti** for practical/wealth-related questions — is the natural next step for closing content-depth gaps, using the exact same pipeline already built (source → transform → tag → embed). Deliberately not attempted in this timeframe, to prioritize a complete, well-tested single-text system over a rushed multi-text one.

---

## How it actually works

### What an embedding is, and why cosine similarity is used

When Cohere embeds a piece of text, it outputs a vector — a list of numbers (1024 of them for `embed-multilingual-v3.0`) representing that text's *meaning* as a point in high-dimensional space. Texts with similar meaning end up as vectors pointing in similar directions, even when they share no common words.

To compare two vectors, this system uses **cosine similarity**:

```
cosine_similarity(A, B) = (A · B) / (||A|| × ||B||)
```

- **Dot product (A · B)** — multiply corresponding elements and sum them. Large and positive when two vectors point in a similar direction, near zero when unrelated.
- **Magnitude (||A||, ||B||)** — the length of each vector. Dividing by both magnitudes normalizes out differences in text length, leaving a pure measure of *directional alignment* — i.e., how similar the meaning is, regardless of how long either piece of text was.

The result is mathematically `cos(θ)`, the cosine of the angle between the two vectors — hence the name. In practice, real embedding models rarely span the full theoretical range: this system's empirical testing showed weak/unrelated matches scoring ~0.43–0.45 and strong/relevant matches scoring ~0.64–0.70 for this specific embedding model, which is why the confidence threshold (0.55) was calibrated against real data rather than assumed from the theoretical -1 to 1 range.

**Retrieval is pure math, not AI.** The similarity search itself (`server/services/retrieval.js`) is plain JavaScript — a loop computing cosine similarity between the query vector and all 701 stored verse vectors, sorting, and returning the top 3. No LLM is involved in this step; only the embedding model (Cohere) that converts text to vectors in the first place.

### How generation is grounded — retrieval and generation are separate stages

A common misconception about RAG is that the generation model does the "searching." It doesn't. By the time the generation model (Gemini) receives anything, retrieval is already finished — the top-3 verses have already been selected via the cosine similarity math above, and `server/services/promptBuilder.js` has already assembled them into plain text alongside the user's question and a language instruction.

The generation model's only job is to read that finished, pre-narrowed text prompt and write a coherent, natural-language answer using it — it never sees the other 698 verses, never performs a search, and never decides what's relevant. This separation is precisely what makes RAG efficient: the expensive, creative LLM call happens exactly once per question, over a small, already-relevant context, rather than needing the model to reason over the entire corpus itself.

The **confidence threshold** is the gate between these two stages: if the top retrieved verse's similarity score is below 0.55, `promptBuilder.js` changes the instruction given to the generation model — from "cite and explain these verses confidently" to "these are only loosely related; be honest that nothing fits well rather than forcing a connection." The generation model always answers based on what it's told about the retrieved verses' relevance — it doesn't independently judge this itself.

---

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js / Express |
| Embeddings | Cohere `embed-multilingual-v3.0` |
| Generation | Google Gemini `gemini-3.5-flash-lite` |
| Retrieval | In-memory cosine similarity (no vector DB) |
| Hosting | Render (single free-tier Web Service) |

---

## Project structure

```
sanskrit-wisdom-bot/
├── server/
│   ├── index.js                        # Express entrypoint, serves API + built frontend
│   ├── routes/chat.js                  # POST /api/chat — the full RAG pipeline
│   ├── services/
│   │   ├── cohereEmbeddings.js         # Query + batch embedding (active)
│   │   ├── gemini.js                   # Answer generation (active)
│   │   ├── retrieval.js                # Cosine similarity search
│   │   └── promptBuilder.js            # Grounded prompt assembly + confidence gate
│   ├── scripts/
│   │   ├── transformGitaData.js        # One-time: source data → verses.json
│   │   ├── buildEmbeddings.cohere.js   # One-time: verses.json → embeddings.json (active)
│   │   ├── buildEmbeddings.js          # Original Gemini-based approach (kept for reference — see pivot #1 above)
│   │   └── generateThemeTags.js        # One-time: content enrichment for retrieval quality
│   └── data/
│       ├── verses.json                 # 701 verses, structured, theme-tagged
│       └── embeddings.json             # Precomputed vector index
└── client/
    └── src/
        ├── components/                 # ChatWindow, MessageBubble, LanguageSelector
        └── api/chatApi.js              # Fetch wrapper for /api/chat
```

---

## Running locally

```bash
npm install
cd client && npm install && cd ..
```

Create a `.env` file in the project root:
```
GEMINI_API_KEY=your_key_here
COHERE_API_KEY=your_key_here
```

The data pipeline has already been run and committed (`server/data/verses.json` and `embeddings.json` are included), so you don't need to re-run the transform/embed/tag scripts to try the app. To start:

```bash
node server/index.js       # starts the API on :3000
cd client && npm run dev   # starts the frontend dev server, proxies /api to :3000
```

To regenerate the data pipeline from scratch:
```bash
npm run transform       # rebuild verses.json from source data
npm run embed:cohere    # rebuild embeddings.json
node server/scripts/generateThemeTags.js   # regenerate theme tags (has resume logic)
```

---

## Known limitations

- **Cold start on free hosting tier.** Render's free Web Service tier spins down after inactivity; the first request after idle time takes 20–50+ seconds while it restarts. Render displays its own "service starting" message during this, so it's not a silent failure.
- **Citation text stays in English/Sanskrit** for Spanish/German responses, since authentic scholarly translations only exist for English and Hindi in the source dataset (see multilingual section above).
- **Output language is dropdown-selected, not auto-detected** from the input text.
- **Content-depth boundary:** as a single-text (701-verse) corpus, some highly specific or compound life scenarios genuinely aren't addressed by any verse at the needed level of nuance. The system is designed to say so honestly rather than force a weak citation — see the theme-tagging section above for a concrete, tested example.