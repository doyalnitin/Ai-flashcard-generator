import streamlit as st
import google.generativeai as genai
import json
import os
from dotenv import load_dotenv
from PIL import Image
import io

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Page config
st.set_page_config(
    page_title="FlashMind — AI Flashcard Maker",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    
    * { font-family: 'Inter', sans-serif; }
    
    .stApp {
        background: #fafafa;
        color: #18181b;
    }
    
    /* Hide Streamlit defaults */
    #MainMenu, footer, header { visibility: hidden; }
    .stDeployButton { display: none; }
    
    /* Nav */
    .nav-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        background: rgba(255,255,255,0.85);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(0,0,0,0.06);
        padding: 0 2rem;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .nav-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        font-size: 17px;
        color: #18181b;
    }
    
    .nav-logo-icon {
        width: 32px;
        height: 32px;
        background: #18181b;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
    }
    
    /* Hero */
    .hero-section {
        padding: 8rem 2rem 3rem;
        text-align: center;
        position: relative;
        overflow: hidden;
    }
    
    .hero-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: radial-gradient(circle, #ddd 1px, transparent 1px);
        background-size: 28px 28px;
        opacity: 0.35;
    }
    
    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: white;
        border: 1px solid #e4e4e7;
        color: #71717a;
        font-size: 11px;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 100px;
        margin-bottom: 2rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }
    
    .hero-badge-dot {
        width: 6px;
        height: 6px;
        background: #10b981;
        border-radius: 50%;
    }
    
    .hero-title {
        font-size: clamp(2.5rem, 6vw, 4.5rem);
        font-weight: 900;
        line-height: 1.06;
        letter-spacing: -0.02em;
        margin-bottom: 1.5rem;
        color: #18181b;
    }
    
    .hero-title .accent { color: #7c3aed; }
    
    .hero-subtitle {
        font-size: 1.125rem;
        color: #71717a;
        max-width: 28rem;
        margin: 0 auto 2.5rem;
        line-height: 1.6;
    }
    
    /* Cards */
    .section-title {
        font-size: clamp(1.5rem, 3vw, 2.25rem);
        font-weight: 700;
        letter-spacing: -0.02em;
        text-align: center;
        margin-bottom: 3rem;
        color: #18181b;
    }
    
    .feature-card {
        background: #f4f4f5;
        border: 1px solid #e4e4e7;
        border-radius: 16px;
        padding: 1.75rem;
        transition: all 0.3s;
    }
    
    .feature-card:hover {
        box-shadow: 0 8px 30px rgba(0,0,0,0.08);
        transform: translateY(-2px);
    }
    
    .feature-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
        font-size: 20px;
    }
    
    .feature-icon.violet { background: #ede9fe; color: #7c3aed; }
    .feature-icon.green { background: #d1fae5; color: #10b981; }
    .feature-icon.amber { background: #fef3c7; color: #f59e0b; }
    
    .feature-title {
        font-weight: 700;
        font-size: 1rem;
        color: #18181b;
        margin-bottom: 0.5rem;
    }
    
    .feature-desc {
        font-size: 0.875rem;
        color: #71717a;
        line-height: 1.6;
    }
    
    /* Step cards */
    .step-card {
        background: white;
        border: 1px solid #e4e4e7;
        border-radius: 16px;
        overflow: hidden;
        transition: all 0.3s;
    }
    
    .step-card:hover {
        box-shadow: 0 8px 30px rgba(0,0,0,0.08);
    }
    
    .step-illustration {
        height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .step-illustration.violet { background: linear-gradient(135deg, #f5f3ff, #ede9fe); }
    .step-illustration.green { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
    .step-illustration.amber { background: linear-gradient(135deg, #fffbeb, #fef3c7); }
    
    .step-icon-box {
        width: 80px;
        height: 80px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
    }
    
    .step-content {
        padding: 1.5rem;
    }
    
    .step-number {
        width: 28px;
        height: 28px;
        background: #18181b;
        color: white;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 1rem;
    }
    
    .step-title {
        font-weight: 700;
        color: #18181b;
        margin-bottom: 0.5rem;
    }
    
    .step-desc {
        font-size: 0.875rem;
        color: #71717a;
        line-height: 1.6;
    }
    
    /* Flashcard */
    .flashcard-container {
        perspective: 1000px;
        width: 240px;
        height: 240px;
        margin: 0 auto;
        cursor: pointer;
    }
    
    .flashcard {
        width: 100%;
        height: 100%;
        position: relative;
        transform-style: preserve-3d;
        transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .flashcard.flipped {
        transform: rotateY(180deg);
    }
    
    .flashcard-face {
        position: absolute;
        inset: 0;
        backface-visibility: hidden;
        border-radius: 20px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        color: white;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    }
    
    .flashcard-front {
        background: linear-gradient(135deg, #7c3aed, #4f46e5);
    }
    
    .flashcard-back {
        background: linear-gradient(135deg, #34d399, #14b8a6);
        transform: rotateY(180deg);
    }
    
    .flashcard-badge {
        display: inline-flex;
        background: rgba(255,255,255,0.2);
        font-size: 10px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 100px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        width: fit-content;
    }
    
    .flashcard-progress {
        color: rgba(255,255,255,0.5);
        font-size: 11px;
        font-weight: 500;
    }
    
    .flashcard-text {
        text-align: center;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.4;
        padding: 0 0.5rem;
    }
    
    .flashcard-hint {
        text-align: center;
        color: rgba(255,255,255,0.4);
        font-size: 11px;
    }
    
    /* Deck cards */
    .deck-card {
        border-radius: 16px;
        padding: 1.25rem;
        color: white;
        position: relative;
        overflow: hidden;
        transition: all 0.3s;
    }
    
    .deck-card:hover {
        transform: scale(1.02);
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    }
    
    .deck-card::before {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 80px;
        height: 80px;
        background: rgba(255,255,255,0.1);
        border-radius: 50%;
        transform: translateY(-24px) translateX(24px);
    }
    
    .deck-title {
        font-weight: 700;
        margin-bottom: 0.5rem;
        position: relative;
        z-index: 1;
    }
    
    .deck-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
        z-index: 1;
    }
    
    .deck-date {
        color: rgba(255,255,255,0.5);
        font-size: 11px;
    }
    
    .deck-count {
        background: rgba(255,255,255,0.2);
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 100px;
    }
    
    /* Globe */
    .globe-section {
        background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
        padding: 5rem 2rem;
        text-align: center;
    }
    
    .globe-title {
        font-size: clamp(1.5rem, 3vw, 2.25rem);
        font-weight: 700;
        color: white;
        margin-bottom: 0.75rem;
        letter-spacing: -0.02em;
    }
    
    .globe-subtitle {
        color: #71717a;
        font-size: 0.875rem;
    }
    
    /* Buttons */
    .stButton > button {
        background: #7c3aed !important;
        color: white !important;
        border: none !important;
        border-radius: 14px !important;
        padding: 0.75rem 2rem !important;
        font-weight: 600 !important;
        font-size: 15px !important;
        transition: all 0.25s !important;
        box-shadow: 0 4px 20px rgba(124,58,237,0.25) !important;
        width: 100%;
    }
    
    .stButton > button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 32px rgba(124,58,237,0.35) !important;
    }
    
    /* Inputs */
    .stTextInput > div > div > input,
    .stTextArea > div > div > textarea {
        background: #f4f4f5 !important;
        border: 1.5px solid #e4e4e7 !important;
        border-radius: 12px !important;
        padding: 12px 16px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
    }
    
    .stTextInput > div > div > input:focus,
    .stTextArea > div > div > textarea:focus {
        border-color: #7c3aed !important;
        box-shadow: 0 0 0 3px rgba(124,58,237,0.1) !important;
    }
    
    /* Footer */
    .footer {
        padding: 3rem 2rem;
        border-top: 1px solid #e4e4e7;
        background: white;
    }
    
    .footer-content {
        max-width: 72rem;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .footer-text {
        color: #a1a1aa;
        font-size: 12px;
    }
    
    /* Scheduler buttons */
    .scheduler-btn {
        flex: 1;
        padding: 8px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 12px;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .scheduler-btn.again { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; }
    .scheduler-btn.hard { background: #fffbeb; color: #f59e0b; border: 1px solid #fde68a; }
    .scheduler-btn.good { background: #ecfdf5; color: #10b981; border: 1px solid #a7f3d0; }
    .scheduler-btn.easy { background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; }
    
    .scheduler-btn:hover { transform: translateY(-1px); }
    
    /* Success card */
    .success-card {
        background: linear-gradient(135deg, #34d399, #14b8a6);
        border-radius: 20px;
        padding: 2rem;
        text-align: center;
        color: white;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    }
    
    .success-emoji { font-size: 3rem; margin-bottom: 0.75rem; }
    .success-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem; }
    .success-subtitle { color: rgba(255,255,255,0.6); font-size: 13px; margin-bottom: 1rem; }
    
    .success-btn {
        background: white;
        color: #10b981;
        border: none;
        padding: 10px 28px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .success-btn:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
</style>
""", unsafe_allow_html=True)

# Session state
if 'cards' not in st.session_state:
    st.session_state.cards = []
if 'current_index' not in st.session_state:
    st.session_state.current_index = 0
if 'is_flipped' not in st.session_state:
    st.session_state.is_flipped = False
if 'decks' not in st.session_state:
    st.session_state.decks = []
if 'deck_counter' not in st.session_state:
    st.session_state.deck_counter = 1

def generate_cards_from_text(text):
    """Generate flashcards from text using Gemini"""
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    prompt = f"""Generate a collection of comprehensive, atomic flashcards based strictly on the following text content:

{text}

Adhere to these rules:
1. MINIMUM INFORMATION PRINCIPLE: Each card must contain exactly ONE atomic concept or fact.
2. TYPES OF CARDS: Use "QA" for direct concept questions and "CLOZE" for fill-in-the-blank statements.
3. CLOZE STYLE: Replace key technical terms with "______" in the front, and provide the isolated keyword in the back.
4. AVOID AMBIGUITY: The front text must contain clear baseline context.

Return JSON format: {{"cards": [{{"type": "QA" or "CLOZE", "front": "...", "back": "..."}}]}}"""
    
    response = model.generate_content(prompt)
    text_response = response.text
    
    # Extract JSON from response
    if "```json" in text_response:
        text_response = text_response.split("```json")[1].split("```")[0]
    elif "```" in text_response:
        text_response = text_response.split("```")[1].split("```")[0]
    
    result = json.loads(text_response.strip())
    return result.get('cards', [])

def generate_cards_from_image(image):
    """Generate flashcards from image using Gemini"""
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    prompt = """Generate a collection of comprehensive, atomic flashcards based strictly on the content shown in this image.

Adhere to these rules:
1. MINIMUM INFORMATION PRINCIPLE: Each card must contain exactly ONE atomic concept or fact.
2. TYPES OF CARDS: Use "QA" for direct concept questions and "CLOZE" for fill-in-the-blank statements.
3. CLOZE STYLE: Replace key technical terms with "______" in the front, and provide the isolated keyword in the back.
4. AVOID AMBIGUITY: The front text must contain clear baseline context.

Return JSON format: {"cards": [{"type": "QA" or "CLOZE", "front": "...", "back": "..."}]}"""
    
    response = model.generate_content([prompt, image])
    text_response = response.text
    
    # Extract JSON from response
    if "```json" in text_response:
        text_response = text_response.split("```json")[1].split("```")[0]
    elif "```" in text_response:
        text_response = text_response.split("```")[1].split("```")[0]
    
    result = json.loads(text_response.strip())
    return result.get('cards', [])

def reset_flashcard():
    st.session_state.is_flipped = False

def next_card():
    st.session_state.current_index += 1
    st.session_state.is_flipped = False

def flip_card():
    st.session_state.is_flipped = not st.session_state.is_flipped

# NAV
st.markdown("""
<div class="nav-container">
    <div class="nav-logo">
        <div class="nav-logo-icon">🧠</div>
        flashmind
    </div>
</div>
<div style="height: 64px;"></div>
""", unsafe_allow_html=True)

# HERO
st.markdown("""
<div class="hero-section">
    <div style="position: relative; z-index: 1;">
        <div class="hero-badge">
            <span class="hero-badge-dot"></span>
            Trusted by 1.2M+ students worldwide
        </div>
        <h1 class="hero-title">
            Study smarter,<br>not harder<span class="accent">.</span>
        </h1>
        <p class="hero-subtitle">
            Upload your notes or images. AI generates flashcards, quizzes, and highlights — instantly.
        </p>
    </div>
</div>
""", unsafe_allow_html=True)

# CREATE FLASHCARDS SECTION
st.markdown("<div style='padding: 0 2rem; max-width: 72rem; margin: 0 auto;'><div class='section-title'>Create flashcards</div></div>", unsafe_allow_html=True)

col1, col2 = st.columns([3, 2], gap="large")

with col1:
    st.markdown("""
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
        <div style="width: 40px; height: 40px; background: #ede9fe; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📝</div>
        <div>
            <div style="font-weight: 700; font-size: 1rem; color: #18181b;">Create flashcards</div>
            <div style="font-size: 12px; color: #a1a1aa;">Paste notes or upload an image</div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    deck_name = st.text_input("", placeholder="Deck name (e.g. Heart Anatomy)", label_visibility="collapsed")
    study_text = st.text_area("", placeholder="Paste your study notes here...", height=150, label_visibility="collapsed")
    
    uploaded_file = st.file_uploader("", type=["png", "jpg", "jpeg", "webp", "gif"], label_visibility="collapsed", key="file_uploader")
    
    if uploaded_file:
        st.success(f"📎 {uploaded_file.name}")
    
    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        if st.button("Generate from text", key="btn_text", use_container_width=True):
            if not deck_name or not study_text:
                st.error("Please enter a deck name and paste your study notes.")
            else:
                with st.spinner("Generating flashcards..."):
                    try:
                        cards = generate_cards_from_text(study_text)
                        st.session_state.cards = cards
                        st.session_state.current_index = 0
                        st.session_state.is_flipped = False
                        
                        # Save deck
                        st.session_state.decks.insert(0, {
                            'id': st.session_state.deck_counter,
                            'title': deck_name,
                            'cards': cards,
                            'count': len(cards)
                        })
                        st.session_state.deck_counter += 1
                        st.success(f"✅ Generated {len(cards)} flashcards!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
    
    with col_btn2:
        if uploaded_file:
            if st.button("Generate from image", key="btn_image", use_container_width=True):
                if not deck_name:
                    st.error("Please enter a deck name.")
                else:
                    with st.spinner("Processing image..."):
                        try:
                            image = Image.open(uploaded_file)
                            cards = generate_cards_from_image(image)
                            st.session_state.cards = cards
                            st.session_state.current_index = 0
                            st.session_state.is_flipped = False
                            
                            # Save deck
                            st.session_state.decks.insert(0, {
                                'id': st.session_state.deck_counter,
                                'title': deck_name,
                                'cards': cards,
                                'count': len(cards)
                            })
                            st.session_state.deck_counter += 1
                            st.success(f"✅ Generated {len(cards)} flashcards!")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error: {str(e)}")

with col2:
    st.markdown("<div style='text-align: center; margin-bottom: 1rem; color: #a1a1aa; font-size: 12px;'>Flashcard Preview</div>", unsafe_allow_html=True)
    
    if st.session_state.cards and st.session_state.current_index < len(st.session_state.cards):
        card = st.session_state.cards[st.session_state.current_index]
        card_type = card.get('type', 'QA')
        front = card.get('front', '')
        back = card.get('back', '')
        
        flipped_class = "flipped" if st.session_state.is_flipped else ""
        
        if st.session_state.is_flipped:
            st.markdown(f"""
            <div class="flashcard-container">
                <div class="flashcard {flipped_class}">
                    <div class="flashcard-face flashcard-front">
                        <div>
                            <span class="flashcard-badge">{card_type}</span>
                            <span class="flashcard-progress" style="float: right;">{st.session_state.current_index + 1} / {len(st.session_state.cards)}</span>
                        </div>
                        <div class="flashcard-text">{front}</div>
                        <div class="flashcard-hint">Tap to flip</div>
                    </div>
                    <div class="flashcard-face flashcard-back">
                        <div><span class="flashcard-badge">Answer</span></div>
                        <div class="flashcard-text">{back}</div>
                        <div class="flashcard-hint">How well did you know it?</div>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="flashcard-container">
                <div class="flashcard {flipped_class}">
                    <div class="flashcard-face flashcard-front">
                        <div>
                            <span class="flashcard-badge">{card_type}</span>
                            <span class="flashcard-progress" style="float: right;">{st.session_state.current_index + 1} / {len(st.session_state.cards)}</span>
                        </div>
                        <div class="flashcard-text">{front}</div>
                        <div class="flashcard-hint">Tap to flip</div>
                    </div>
                    <div class="flashcard-face flashcard-back">
                        <div><span class="flashcard-badge">Answer</span></div>
                        <div class="flashcard-text">{back}</div>
                        <div class="flashcard-hint">How well did you know it?</div>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)
        
        # Flip button
        st.markdown("<div style='height: 1rem;'></div>", unsafe_allow_html=True)
        
        if st.button(" Flip Card", key="flip", use_container_width=True):
            flip_card()
            st.rerun()
        
        # Scheduler buttons
        st.markdown("<div style='height: 0.5rem;'></div>", unsafe_allow_html=True)
        
        sched_cols = st.columns(4)
        with sched_cols[0]:
            if st.button("Again", key="again", use_container_width=True):
                next_card()
                st.rerun()
        with sched_cols[1]:
            if st.button("Hard", key="hard", use_container_width=True):
                next_card()
                st.rerun()
        with sched_cols[2]:
            if st.button("Good", key="good", use_container_width=True):
                next_card()
                st.rerun()
        with sched_cols[3]:
            if st.button("Easy", key="easy", use_container_width=True):
                next_card()
                st.rerun()
    
    elif st.session_state.cards and st.session_state.current_index >= len(st.session_state.cards):
        st.markdown("""
        <div class="success-card">
            <div class="success-emoji">🎉</div>
            <div class="success-title">All done!</div>
            <div class="success-subtitle">Deck reviewed</div>
        </div>
        """, unsafe_allow_html=True)
        
        if st.button("Back to Start", key="back", use_container_width=True):
            st.session_state.current_index = 0
            st.session_state.is_flipped = False
            st.rerun()
    else:
        st.markdown("""
        <div class="flashcard-container">
            <div class="flashcard">
                <div class="flashcard-face flashcard-front">
                    <div>
                        <span class="flashcard-badge">QA</span>
                        <span class="flashcard-progress" style="float: right;">0 / 0</span>
                    </div>
                    <div class="flashcard-text">Generate flashcards to start...</div>
                    <div class="flashcard-hint">Tap to flip</div>
                </div>
                <div class="flashcard-face flashcard-back">
                    <div><span class="flashcard-badge">Answer</span></div>
                    <div class="flashcard-text">The answer appears here</div>
                    <div class="flashcard-hint">How well did you know it?</div>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)

# FEATURES SECTION
st.markdown("<div style='height: 4rem;'></div>", unsafe_allow_html=True)
st.markdown("""
<div style="background: white; padding: 5rem 2rem;">
    <div style="max-width: 72rem; margin: 0 auto;">
        <div class="section-title">Everything you need to ace your exams</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
            <div class="feature-card">
                <div class="feature-icon violet">🃏</div>
                <div class="feature-title">AI Flashcard Generator</div>
                <div class="feature-desc">Paste text or upload an image — AI creates perfect Q&A flashcards in seconds.</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon green">📈</div>
                <div class="feature-title">Spaced Repetition</div>
                <div class="feature-desc">Smart scheduling algorithm optimizes review timing for maximum retention.</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon amber">📸</div>
                <div class="feature-title">Image Recognition</div>
                <div class="feature-desc">Upload photos of textbooks, slides, or handwritten notes — AI extracts and creates cards.</div>
            </div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# HOW IT WORKS
st.markdown("""
<div style="background: #f4f4f5; padding: 5rem 2rem;">
    <div style="max-width: 72rem; margin: 0 auto;">
        <div class="section-title">Three steps to smarter studying</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
            <div class="step-card">
                <div class="step-illustration violet">
                    <div class="step-icon-box">📤</div>
                </div>
                <div class="step-content">
                    <div class="step-number">1</div>
                    <div class="step-title">Upload your notes</div>
                    <div class="step-desc">Paste text or upload a photo of your study material.</div>
                </div>
            </div>
            <div class="step-card">
                <div class="step-illustration green">
                    <div class="step-icon-box">✨</div>
                </div>
                <div class="step-content">
                    <div class="step-number">2</div>
                    <div class="step-title">AI generates cards</div>
                    <div class="step-desc">Our AI creates high-quality flashcards and highlights key concepts.</div>
                </div>
            </div>
            <div class="step-card">
                <div class="step-illustration amber">
                    <div class="step-icon-box">✅</div>
                </div>
                <div class="step-content">
                    <div class="step-number">3</div>
                    <div class="step-title">Study & remember</div>
                    <div class="step-desc">Review with spaced repetition. Track progress and ace your exams.</div>
                </div>
            </div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# SUBJECTS / GLOBE
st.markdown("""
<div class="globe-section">
    <div style="max-width: 72rem; margin: 0 auto;">
        <div class="globe-title">Whatever you study,<br>we've got you covered.</div>
        <div class="globe-subtitle">Click a subject to explore flashcard decks</div>
    </div>
</div>
""", unsafe_allow_html=True)

# SAVED DECKS
if st.session_state.decks:
    st.markdown("""
    <div style="background: white; padding: 4rem 2rem;">
        <div style="max-width: 72rem; margin: 0 auto;">
            <div style="background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 20px; padding: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div style="font-weight: 700; font-size: 1.25rem; color: #18181b;">Your study sets</div>
                    <div style="font-size: 12px; color: #a1a1aa; font-weight: 500;">Auto-saved</div>
                </div>
    """, unsafe_allow_html=True)
    
    deck_cols = st.columns(3)
    colors = ['linear-gradient(135deg, #7c3aed, #4f46e5)', 'linear-gradient(135deg, #ec4899, #f43f5e)', 'linear-gradient(135deg, #3b82f6, #06b6d4)', 'linear-gradient(135deg, #10b981, #14b8a6)', 'linear-gradient(135deg, #f59e0b, #f97316)']
    
    for i, deck in enumerate(st.session_state.decks):
        with deck_cols[i % 3]:
            color = colors[i % len(colors)]
            st.markdown(f"""
            <div class="deck-card" style="background: {color}; margin-bottom: 1rem;">
                <div class="deck-title">{deck['title']}</div>
                <div class="deck-meta">
                    <span class="deck-date">Today</span>
                    <span class="deck-count">{deck['count']} cards</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown("</div></div></div>", unsafe_allow_html=True)

# FOOTER
st.markdown("""
<div class="footer">
    <div class="footer-content">
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; background: #18181b; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;">🧠</div>
            <span class="footer-text">© 2026 FlashMind. All rights reserved.</span>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)
