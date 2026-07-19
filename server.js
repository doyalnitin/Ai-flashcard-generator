import express from 'express';
import Database from 'better-sqlite3';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as pdfParse from 'pdf-parse';

dotenv.config();

const app = express();
const port = 3000;

// Configure directory context paths for serving frontend layouts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Configure multer for file uploads (memory storage for buffer access)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

// Initialize or open local SQLite storage file
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const db = new Database(path.join(dataDir, 'flashcards.db'));

// Build structural database schema layout tables
db.exec(`
  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deck_id INTEGER,
    type TEXT CHECK(type IN ('QA', 'CLOZE')),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE CASCADE
  );
`);

// Initialize the Google Gen AI client wrapper
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Core AI extraction logic using the verified Gemini structural schema
 */
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

  const result = JSON.parse(response.text);
  return result.cards;
}

/**
 * Generate flashcards from an image using Gemini multimodal API
 */
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

  const result = JSON.parse(response.text);
  return result.cards;
}

/**
 * Generate flashcards from a PDF file (extract text first, then generate)
 */
async function generateCardsFromPDF(buffer) {
  const pdfData = await pdfParse(buffer);
  if (!pdfData.text || pdfData.text.trim().length === 0) {
    throw new Error("No text content found in the PDF");
  }
  return generateCardsFromAI(pdfData.text);
}

// API ENDPOINT: Fetch all saved decks along with total card metrics
app.get('/api/decks', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT d.*, COUNT(c.id) as totalCards 
      FROM decks d LEFT JOIN cards c ON d.id = c.deck_id 
      GROUP BY d.id ORDER BY d.created_at DESC
    `);
    const data = stmt.all();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API ENDPOINT: Fetch specific target card records inside a deck
app.get('/api/decks/:id/cards', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM cards WHERE deck_id = ?');
    const data = stmt.all(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API ENDPOINT: Upload a PDF or image file, generate flashcards from it
app.post('/api/decks/upload', upload.single('file'), async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "Missing deck title" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    let rawCards;
    const { mimetype, buffer } = req.file;

    if (mimetype === 'application/pdf') {
      rawCards = await generateCardsFromPDF(buffer);
    } else if (mimetype.startsWith('image/')) {
      rawCards = await generateCardsFromImage(buffer, mimetype);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const insertDeck = db.prepare('INSERT INTO decks (title) VALUES (?)');
    const insertCard = db.prepare('INSERT INTO cards (deck_id, type, front, back) VALUES (?, ?, ?, ?)');

    const transaction = db.transaction((deckTitle, cardsList) => {
      const info = insertDeck.run(deckTitle);
      const newDeckId = info.lastInsertRowid;
      for (const card of cardsList) {
        insertCard.run(newDeckId, card.type, card.front, card.back);
      }
      return newDeckId;
    });

    const generatedDeckId = transaction(title, rawCards);
    res.json({ success: true, deckId: generatedDeckId, totalGenerated: rawCards.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Processing failed: " + err.message });
  }
});

// API ENDPOINT: Receive text manual data, parse via AI, and store inside database
app.post('/api/decks/generate', async (req, res) => {
  const { title, text } = req.body;
  if (!title || !text) return res.status(400).json({ error: "Missing layout title or manual content body parameters" });
  if (typeof title !== 'string' || typeof text !== 'string') return res.status(400).json({ error: "Title and text must be strings" });
  if (title.length > 200) return res.status(400).json({ error: "Title too long (max 200 chars)" });
  if (text.length > 50000) return res.status(400).json({ error: "Text too long (max 50000 chars)" });

  try {
    const rawCards = await generateCardsFromAI(text);

    // SQL Transaction process execution to secure atomic multi-table injection logic
    const insertDeck = db.prepare('INSERT INTO decks (title) VALUES (?)');
    const insertCard = db.prepare('INSERT INTO cards (deck_id, type, front, back) VALUES (?, ?, ?, ?)');

    const transaction = db.transaction((deckTitle, cardsList) => {
      const info = insertDeck.run(deckTitle);
      const newDeckId = info.lastInsertRowid;

      for (const card of cardsList) {
        insertCard.run(newDeckId, card.type, card.front, card.back);
      }
      return newDeckId;
    });

    const generatedDeckId = transaction(title, rawCards);
    res.json({ success: true, deckId: generatedDeckId, totalGenerated: rawCards.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Pipeline processing failure caught: " + err.message });
  }
});

// Express v5 catch-all route for SPA
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Full-stack Flashcard server roaring on: http://localhost:${port}`);
});