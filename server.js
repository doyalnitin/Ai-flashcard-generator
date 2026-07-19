import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
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

// In-memory storage (resets on cold start on Vercel)
let decks = [];
let cards = [];
let nextDeckId = 1;
let nextCardId = 1;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function extractText(response) {
  try {
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
      return response.candidates[0].content.parts[0].text;
    }
    if (typeof response.text === 'function') return response.text();
    if (response.text) return response.text;
  } catch (e) {
    console.error('Response extraction error:', e);
  }
  throw new Error('Could not extract text from Gemini response');
}

async function generateCardsFromAI(sourceText) {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Generate flashcards from this text. Return JSON only, no markdown:\n\n${sourceText}`,
    config: {
      systemInstruction: `You are an expert flashcard generator. Convert text into atomic flashcards. Rules:
1. Each card = ONE concept
2. Use "QA" for questions, "CLOZE" for fill-in-blank
3. For CLOZE: use "______" in front, isolated term in back
4. Return valid JSON: {"cards":[{"type":"QA","front":"...","back":"..."}]}`,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["QA", "CLOZE"] },
                front: { type: Type.STRING },
                back: { type: Type.STRING },
              },
              required: ["type", "front", "back"],
            },
          },
        },
        required: ["cards"],
      },
    },
  });

  const text = extractText(response);
  const result = JSON.parse(text);
  return result.cards;
}

async function generateCardsFromImage(buffer, mimeType) {
  const base64Data = buffer.toString('base64');
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Generate flashcards from this image. Return JSON only, no markdown." },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }
    ],
    config: {
      systemInstruction: `You are an expert flashcard generator. Convert text into atomic flashcards. Rules:
1. Each card = ONE concept
2. Use "QA" for questions, "CLOZE" for fill-in-blank
3. For CLOZE: use "______" in front, isolated term in back
4. Return valid JSON: {"cards":[{"type":"QA","front":"...","back":"..."}]}`,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["QA", "CLOZE"] },
                front: { type: Type.STRING },
                back: { type: Type.STRING },
              },
              required: ["type", "front", "back"],
            },
          },
        },
        required: ["cards"],
      },
    },
  });

  const text = extractText(response);
  const result = JSON.parse(text);
  return result.cards;
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

// Health check
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
  if (!title) return res.status(400).json({ error: "Missing deck title" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const { mimetype, buffer } = req.file;
    const rawCards = await generateCardsFromImage(buffer, mimetype);
    const deckId = saveCards(title, rawCards);
    res.json({ success: true, deckId, totalGenerated: rawCards.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Processing failed: " + err.message });
  }
});

app.post('/api/decks/generate', async (req, res) => {
  const { title, text } = req.body;
  if (!title || !text) return res.status(400).json({ error: "Please provide a name and text." });
  if (typeof title !== 'string' || typeof text !== 'string') return res.status(400).json({ error: "Title and text must be text." });
  if (title.length > 200) return res.status(400).json({ error: "Name too long (max 200 characters)" });
  if (text.length > 50000) return res.status(400).json({ error: "Text too long (max 50000 characters)" });

  try {
    const rawCards = await generateCardsFromAI(text);
    const deckId = saveCards(title, rawCards);
    res.json({ success: true, deckId, totalGenerated: rawCards.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong: " + err.message });
  }
});

// Catch-all route MUST be last
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default app;
