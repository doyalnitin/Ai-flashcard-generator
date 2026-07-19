import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  }
});

let decks = [];
let cards = [];
let nextDeckId = 1;
let nextCardId = 1;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function imageToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType
    }
  };
}

const FLASHCARD_PROMPT = `You are an expert flashcard generator. Convert the provided content into atomic flashcards.

Rules:
1. Each card must contain exactly ONE atomic concept or fact.
2. Use "QA" for direct question-answer cards.
3. Use "CLOZE" for fill-in-the-blank cards. Replace key terms with "______" in the front, provide the term in the back.
4. Keep fronts clear and unambiguous.

Return ONLY valid JSON (no markdown, no code fences):
{"cards":[{"type":"QA","front":"...","back":"..."}]}`;

async function generateCardsFromText(text) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          cards: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING' },
                front: { type: 'STRING' },
                back: { type: 'STRING' }
              },
              required: ['type', 'front', 'back']
            }
          }
        },
        required: ['cards']
      }
    }
  });

  const result = await model.generateContent(FLASHCARD_PROMPT + '\n\n' + text);
  const response = result.response;
  const data = JSON.parse(response.text());
  return data.cards;
}

async function generateCardsFromImage(buffer, mimeType) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const imagePart = imageToGenerativePart(buffer, mimeType);

  const result = await model.generateContent([
    FLASHCARD_PROMPT + '\n\nGenerate flashcards from the content in this image.',
    imagePart
  ]);

  const response = result.response;
  let text = response.text();

  // Strip markdown fences if present
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  const data = JSON.parse(text);
  return data.cards;
}

function saveCards(deckTitle, rawCards) {
  const deckId = nextDeckId++;
  const now = new Date().toISOString();
  decks.push({ id: deckId, title: deckTitle, created_at: now });
  for (const card of rawCards) {
    cards.push({ id: nextCardId++, deck_id: deckId, type: card.type, front: card.front, back: card.back });
  }
  return deckId;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasApiKey: !!process.env.GEMINI_API_KEY });
});

app.get('/api/decks', (req, res) => {
  const result = decks
    .map(d => ({
      ...d,
      totalCards: cards.filter(c => c.deck_id === d.id).length
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(result);
});

app.get('/api/decks/:id/cards', (req, res) => {
  const deckCards = cards.filter(c => c.deck_id === Number(req.params.id));
  res.json(deckCards);
});

app.post('/api/decks/upload', upload.single('file'), async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing deck title' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const { mimetype, buffer } = req.file;
    const rawCards = await generateCardsFromImage(buffer, mimetype);
    const deckId = saveCards(title, rawCards);
    res.json({ success: true, deckId, totalGenerated: rawCards.length });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Processing failed: ' + err.message });
  }
});

app.post('/api/decks/generate', async (req, res) => {
  const { title, text } = req.body;
  if (!title || !text) return res.status(400).json({ error: 'Please provide a name and text.' });
  if (typeof title !== 'string' || typeof text !== 'string') return res.status(400).json({ error: 'Title and text must be text.' });
  if (title.length > 200) return res.status(400).json({ error: 'Name too long (max 200 characters)' });
  if (text.length > 50000) return res.status(400).json({ error: 'Text too long (max 50000 characters)' });

  try {
    const rawCards = await generateCardsFromText(text);
    const deckId = saveCards(title, rawCards);
    res.json({ success: true, deckId, totalGenerated: rawCards.length });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Something went wrong: ' + err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default app;
