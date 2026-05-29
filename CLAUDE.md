# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Ночной Сказочник" (Night Storyteller) — a single-file Russian-language bedtime story generator for children, built as an AI Hackathon project. Open [skazochnik.html](skazochnik.html) directly in any modern browser; no build step or server required.

## Running the App

Open `skazochnik.html` in a browser. The user must paste their own Claude API key into the UI on first use — it is stored in `localStorage`. No build, install, or server setup needed.

## Architecture

Everything lives in a single file (`skazochnik.html`): embedded CSS (lines ~8–408), HTML markup (lines ~410–512), and JavaScript (lines ~515–777).

**External runtime dependencies only (no npm/pip):**
- **Claude API** — `https://api.anthropic.com/v1/messages`, model `claude-sonnet-4-20250514`, called client-side with the user's key and `anthropic-dangerous-direct-browser-access: true`
- **Pollinations.ai** — `https://image.pollinations.ai/prompt/{prompt}` for free watercolor-style illustrations (no key needed)
- **Google Fonts CDN** — Lora + Nunito
- **Web Speech API** — browser-native TTS, Russian (ru-RU), 0.85× rate

**Story generation flow:**
1. User fills form (child name, age 3–10, up to 3 interests, one moral/lesson)
2. `generateStory()` builds a structured prompt and POSTs to the Claude API
3. Response is parsed for story text + a scene description for the illustration
4. `generateIllustration()` fetches an image from Pollinations.ai using the scene description
5. `renderStory()` displays both; `toggleTTS()` reads the story aloud via Web Speech API

**State** is kept in a handful of module-level JS variables (no framework, no reactive state).

## Key Constraints

- The Claude API call is made directly from the browser. Browsers block requests to `api.anthropic.com` without the `anthropic-dangerous-direct-browser-access: true` header — this header must remain in all fetch calls.
- Max interests selectable is 3; enforced in `toggleInterest()`.
- Story prompt targets age-appropriate language and a specific 3-part structure (setup → adventure → gentle conclusion).
