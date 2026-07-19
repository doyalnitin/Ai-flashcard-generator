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

async function generateCardsFromAI(sourceText) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Generate a collection of comprehensive, atomic flashcards based strictly on the following text content:\n\n${sourceText}`,
    config: {
      systemInstruction: `You are an expert industrial microlearning assistant. Your job is to convert raw technical texts, SOPs, and operational manuals into high-yield, atomic flashcards. 
        
      Adhere to these absolute engineering rules:
      1. MINIMUM INFORMATION PRINCIPLE: Each card must contain exactly ONE atomic concept or fact.
      2. TYPES OF CARDS: Use "QA" for direct concept questions and "CLOZE" for fill-in-the-blank statements.
      3. CLOZE STYLE: Replace key technical terms with "______" in the front, and provide the isolated keyword in the back.
      4. AVOID AMBIGUITY: The front text must contain clear baseline context.`,
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

  // Handle different response formats
  let text;
  if (typeof response.text === 'function') {
    text = response.text();
  } else if (response.text) {
    text = response.text;
  } else if (response.candidates && response.candidates[0]) {
    text = response.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Could not extract text from Gemini response');
  }
  
  const result = JSON.parse(text);
  return result.cards;
}

async function generateCardsFromImage(buffer, mimeType) {
  const base64Data = buffer.toString('base64');
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Generate a collection of comprehensive, atomic flashcards based strictly on the content shown in this image." },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }
    ],
    config: {
      systemInstruction: `You are an expert industrial microlearning assistant. Your job is to convert raw technical texts, SOPs, and operational manuals into high-yield, atomic flashcards. 
        
      Adhere to these absolute engineering rules:
      1. MINIMUM INFORMATION PRINCIPLE: Each card must contain exactly ONE atomic concept or fact.
      2. TYPES OF CARDS: Use "QA" for direct concept questions and "CLOZE" for fill-in-the-blank statements.
      3. CLOZE STYLE: Replace key technical terms with "______" in the front, and provide the isolated keyword in the back.
      4. AVOID AMBIGUITY: The front text must contain clear baseline context.`,
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

  // Handle different response formats
  let text;
  if (typeof response.text === 'function') {
    text = response.text();
  } else if (response.text) {
    text = response.text;
  } else if (response.candidates && response.candidates[0]) {
    text = response.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Could not extract text from Gemini response');
  }
  
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
