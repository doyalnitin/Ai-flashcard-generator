# FlashMind

Turn any text or image into study flashcards using AI.

## What it does

- Paste text or upload a photo
- AI automatically creates question-and-answer flashcards
- Study with a flip-card interface

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

## Deploy to Vercel

1. Push to GitHub
2. Import repo on vercel.com
3. Add `GEMINI_API_KEY` as an environment variable
4. Deploy

## Tech Stack

- **Frontend:** HTML, Tailwind CSS, vanilla JavaScript
- **Backend:** Express.js, in-memory storage
- **AI:** Google Gemini 2.5 Flash (text + vision)

# Ai-flashcard-generator
