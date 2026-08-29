require('dotenv').config();
const express = require('express');
const path = require('path');

const chatRoute = require('./routes/chat');
const { loadIndex } = require('./services/retrieval');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API routes
app.use('/api', chatRoute);

// Simple health check — useful for confirming the server is alive,
// both locally and later on Render
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve the built React app (only exists once Phase 3/5 are done —
// safe to leave in now, just won't find anything to serve yet)
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend not built yet. Use POST /api/chat directly for now.');
    }
  });
});

// Load the embeddings index into memory once, then start listening
loadIndex();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});