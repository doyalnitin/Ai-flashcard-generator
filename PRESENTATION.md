# FlashMind — Complete Presentation

---

## 1. What is FlashMind?

FlashMind is an AI-powered web app that turns any text or image into study flashcards automatically. Instead of manually writing flashcards, you paste your notes or upload a photo and the AI creates question-and-answer cards for you.

**The problem it solves:** Students and professionals spend hours creating flashcards manually. FlashMind does this in seconds.

---

## 2. How It Works — End to End

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  User Input  │────▶│  Express.js  │────▶│  Google AI  │────▶│  Flashcards  │
│  (text/photo)│     │   Server     │     │  (Gemini)   │     │  (response)  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

### Step-by-step flow:

**Step 1 — User provides content**
- Paste text (lecture notes, textbook, SOP, manual)
- OR upload a photo (screenshot, scanned document, whiteboard)

**Step 2 — Server receives the request**
- Express.js backend receives the data
- For text: sends directly to Gemini API
- For images: converts to base64 and sends to Gemini Vision API

**Step 3 — AI generates flashcards**
- Gemini 2.5 Flash model processes the content
- Follows strict rules (one fact per card, QA and Cloze formats)
- Returns structured JSON with flashcards

**Step 4 — Flashcards displayed**
- Front: question or fill-in-the-blank statement
- Back: answer or missing word
- User clicks to flip, rates difficulty

---

## 3. Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| HTML5 | Page structure |
| Tailwind CSS (CDN) | Styling and layout |
| Vanilla JavaScript | All interactivity |
| Google Fonts (Inter) | Clean typography |

### Backend
| Technology | Purpose |
|-----------|---------|
| Express.js v5 | Web server and API routes |
| Multer | File upload handling (images) |
| @google/genai | Google Gemini AI SDK |
| dotenv | Environment variable management |

### AI
| Technology | Purpose |
|-----------|---------|
| Gemini 2.5 Flash | Fast, low-cost AI model |
| Structured output (JSON schema) | Ensures consistent flashcard format |
| Vision API | Processes uploaded images |

### Hosting
| Technology | Purpose |
|-----------|---------|
| Vercel | Serverless deployment |
| GitHub | Source code repository |

---

## 4. API Endpoints

### `GET /api/decks`
Returns all saved flashcard sets with card counts.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Biology Notes",
    "created_at": "2026-07-19T10:30:00.000Z",
    "totalCards": 12
  }
]
```

### `GET /api/decks/:id/cards`
Returns all cards in a specific set.

**Response:**
```json
[
  {
    "id": 1,
    "deck_id": 1,
    "type": "QA",
    "front": "What is the powerhouse of the cell?",
    "back": "Mitochondria"
  },
  {
    "id": 2,
    "deck_id": 1,
    "type": "CLOZE",
    "front": "The ______ is responsible for ATP production.",
    "back": "mitochondria"
  }
]
```

### `POST /api/decks/generate`
Creates flashcards from pasted text.

**Request body:**
```json
{
  "title": "Biology Chapter 3",
  "text": "Mitochondria are organelles found in eukaryotic cells..."
}
```

### `POST /api/decks/upload`
Creates flashcards from an uploaded image.

**Request:** `multipart/form-data` with fields:
- `title` — name for the flashcard set
- `file` — image file (PNG, JPG, WebP, GIF)

---

## 5. Flashcard Types

### QA (Question & Answer)
Direct question-and-answer format.

```
Front: "What is the chemical formula for water?"
Back: "H₂O"
```

### CLOZE (Fill-in-the-blank)
Key term is replaced with a blank.

```
Front: "The mitochondria is known as the ______ of the cell."
Back: "powerhouse"
```

---

## 6. AI Prompt Design

The system prompt follows the **Minimum Information Principle** — each card must contain exactly ONE atomic fact. This is based on spaced repetition research showing that smaller, focused cards lead to better retention.

### Rules enforced:
1. One concept per card (no bundling)
2. QA for direct questions, CLOZE for fill-in-the-blank
3. CLOZE front must have context (not just "What is ______?")
4. Back must be a single word or short phrase

### JSON Schema enforcement:
```json
{
  "cards": [
    {
      "type": "QA" | "CLOZE",
      "front": "string",
      "back": "string"
    }
  ]
}
```

This ensures the AI always returns valid, parseable output.

---

## 7. UI/UX Design

### Design philosophy: Light & Minimal
- Soft gray background (#f5f6f8)
- White cards with subtle shadows
- Single accent color (teal)
- Clean Inter font
- No visual clutter

### Layout: 2-column grid
```
┌──────────────────────────────────────────┐
│  Header: Logo + Deck Counter             │
├──────────┬───────────────────────────────┤
│          │                               │
│  Left    │      Right                    │
│  Panel   │      Panel                    │
│          │                               │
│  [Form]  │   ┌─────────────────────┐    │
│  [Decks] │   │                     │    │
│          │   │   Flashcard         │    │
│          │   │   (flip animation)  │    │
│          │   │                     │    │
│          │   └─────────────────────┘    │
│          │   [Again] [Hard] [Easy]      │
│          │                               │
├──────────┴───────────────────────────────┤
│  Footer                                  │
└──────────────────────────────────────────┘
```

### Flashcard flip animation
- Uses CSS 3D transforms (`perspective`, `rotateY`, `backface-visibility`)
- 0.45s cubic-bezier transition for smooth flip
- Front: white background
- Back: soft teal gradient

### File upload
- Drag-and-drop zone with visual feedback
- Click to browse (native file picker)
- Shows selected filename
- Button appears only when file is selected

---

## 8. Security Measures

### Input validation
- Title: max 200 characters, must be string
- Text: max 50,000 characters, must be string
- Files: max 10MB, images only (PNG/JPG/WebP/GIF)

### XSS prevention
- All deck titles escaped with `escapeHtml()` before rendering
- Uses `textContent` instead of `innerHTML` where possible

### API safety
- Multer memory storage (no disk writes)
- MIME type validation on uploads
- No SQL injection (in-memory storage)

---

## 9. Deployment Architecture

### Vercel (Serverless)
```
GitHub Push ──▶ Vercel Build ──▶ Serverless Function
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Express.js   │
                              │  (cold start) │
                              └───────┬───────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Gemini API   │
                              └───────────────┘
```

### Important: In-memory storage
- Data lives in the serverless function's memory
- Resets on cold starts (after ~15 min idle)
- Each request may hit a fresh instance
- For persistence, use Turso, Vercel Postgres, or similar

---

## 10. File Structure

```
ai-flashcard-generator/
├── index.html          # Frontend (HTML + CSS + JS)
├── server.js           # Backend (Express + AI + storage)
├── package.json        # Dependencies
├── package-lock.json   # Locked dependency versions
├── vercel.json         # Vercel deployment config
├── .gitignore          # Git ignored files
├── .env                # API keys (not in git)
├── README.md           # Project documentation
└── data/               # Local SQLite (dev only)
    └── flashcards.db
```

---

## 11. Local Development

```bash
# Install dependencies
npm install

# Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# Start server
node server.js

# Open browser
open http://localhost:3000
```

---

## 12. Key Features Summary

| Feature | How it works |
|---------|-------------|
| Text to flashcards | Paste text → Gemini generates QA/CLOZE cards |
| Image to flashcards | Upload photo → Gemini Vision reads and generates cards |
| Flip animation | CSS 3D transform, click to reveal answer |
| Difficulty rating | Again / Hard / Easy buttons (cosmetic) |
| Deck management | View all saved sets, click to study |
| Drag & drop upload | HTML5 drag events + file API |
| Responsive layout | Tailwind grid, works on mobile and desktop |

---

## 13. Why Gemini 2.5 Flash?

- **Fast**: Optimized for speed, ideal for real-time generation
- **Cheap**: Low cost per request
- **Structured output**: Supports JSON schema enforcement
- **Vision capable**: Can process images directly
- **Long context**: Handles up to 1M tokens of input text

---

## 14. Future Improvements

1. **Spaced repetition**: Implement SM-2 algorithm for smart scheduling
2. **Cloud database**: Turso or Vercel Postgres for persistent storage
3. **PDF support**: Use a Vercel-compatible PDF parser
4. **User accounts**: Auth for personal flashcard libraries
5. **Export**: Download flashcards as Anki-compatible .apkg files
6. **Audio**: Text-to-speech for pronunciation practice
7. **Collaboration**: Share decks with other users
8. **Dark mode**: Theme toggle
9. **Mobile app**: React Native or PWA version
10. **Analytics**: Track study progress and weak areas

---

## 15. Live Demo

**URL:** https://ai-flashcard-generator-nine.vercel.app

### Demo flow:
1. Enter a name (e.g., "Solar System")
2. Paste some text about planets
3. Click "Make cards from text"
4. Flashcards appear — click to flip
5. Use Again/Hard/Easy to rate
6. Try uploading a photo of notes
