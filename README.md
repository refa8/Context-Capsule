# Context Capsule

A Chrome extension (Manifest V3) that captures conversational context from an AI chat session and re-injects it into a new session — solving the context-loss problem when switching between AI chat tools (Claude, ChatGPT, Gemini).

**Status:** In progress — core capture/inject flow implemented; DOM selectors for each site adapter are being tested and refined against live pages.

## How it works

- **Capture**: a content script reads the visible conversation on a supported site and packages the last several turns into a "capsule" (title, source site, timestamp, body text), saved to `chrome.storage.local`.
- **Inject**: from the floating in-page panel or the toolbar popup, pick a saved capsule and it's inserted directly into the current chat's input box.
- **Per-site adapters**: each supported site (Claude, ChatGPT, Gemini) has its own small adapter in `site-adapters.js` defining how to find messages and the input box on that site — so a DOM change on one site doesn't require touching the others.

## Tech Stack

JavaScript, Chrome Extensions API (Manifest V3), `chrome.storage`, DOM manipulation

## Setup

1. Clone this repo
2. Go to `chrome://extensions`, enable Developer Mode
3. Click "Load unpacked" and select the project folder
4. Open a supported chat site — a floating capsule button will appear

## Roadmap

- [ ] Verify and fix DOM selectors against live Claude/ChatGPT/Gemini pages
- [ ] Replace `execCommand`-based text insertion with manually dispatched `InputEvent`s (execCommand is deprecated, still works but not future-proof)
- [ ] Add LLM-based summarization so capsules are compressed rather than raw trimmed text
- [ ] Drag-and-drop capsule insertion instead of click-to-insert
