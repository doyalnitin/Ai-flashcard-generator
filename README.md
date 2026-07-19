# FlashMind

Turn any text, PDF, or image into study flashcards using AI.

## What it does

- Paste text or upload a PDF/image
- AI automatically creates question-and-answer flashcards
- Study with a flip-card interface
- All your flashcards are saved locally

## Quick Start

```bash
npm install
```

Create a `.env` file with your Gemini API key:

```
GEMINI_API_KEY=your_key_here
```

Then run:

```bash
node server.js
```

Open http://localhost:3000 in your browser.

## Tech Stack

- **Frontend:** HTML, Tailwind CSS, vanilla JavaScript
- **Backend:** Express.js, SQLite (better-sqlite3)
- **AI:** Google Gemini 2.5 Flash
- **File parsing:** pdf-parse (for PDFs), Gemini Vision (for images)
