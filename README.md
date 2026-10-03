# Context Capsule

Capture AI conversation context once and seamlessly reuse it across ChatGPT, Claude, and Gemini without requiring page refreshes or reloading the extension.

## Features

- **Multi-Platform Capture**: Extract conversational context from ChatGPT, Claude, and Gemini.
- **Structured Conversation Preview**: View captured turns formatted with role indicators (`YOU` / `ASSISTANT`) and line breaks.
- **Local Capsule Storage**: Save capsules locally in `chrome.storage.local` with metadata (source, message counts, capture timestamps).
- **SPA-Aware Context Injection**: Inject saved capsules into new or existing conversations without needing page refreshes, even after SPA navigation inside the same browser tab.
- **Site Adapter Architecture**: Modular design isolating site-specific DOM selectors (`ChatGPTAdapter`, `ClaudeAdapter`, `GeminiAdapter`).
- **Privacy First**: 100% local operation with no external server requests or API keys required.

## Architecture

Context Capsule follows a modular Manifest V3 architecture with strict separation of responsibilities:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              EXTENSION POPUP                           │
│                      (popup/popup.html, popup.js, popup.css)           │
│  - Captures context via content script                                 │
│  - Renders structured conversation previews (YOU / ASSISTANT)         │
│  - Manages capsule selection, injection, and deletion                   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       BACKGROUND SERVICE WORKER      │  │        CONTENT SCRIPT        │
│           (background.js)            │  │ (content/adapters.js,        │
│  - Storage message routing           │  │  content/content.js)         │
│  - Coordinates storage operations    │  │  - Interacts with site DOM   │
└───────────────────┬──────────────────┘  │  - Extracts messages         │
                    │                     │  - SPA-aware input resolver  │
                    ▼                     └──────────────┬───────────────┘
┌──────────────────────────────────────┐                 │
│         CHROME STORAGE LOCAL         │                 ▼
│          (shared/storage.js)         │  ┌──────────────────────────────┐
│  - Stores capsules array             │  │        SITE ADAPTERS         │
│  - Normalizes legacy/new capsules    │  │ - ChatGPTAdapter             │
└──────────────────────────────────────┘  │ - ClaudeAdapter              │
                                          │ - GeminiAdapter              │
                                          └──────────────────────────────┘
```

## Tech Stack

- **Manifest V3** Chrome Extension framework
- **JavaScript (ES6+)**
- **Chrome Extension APIs**: `chrome.storage.local`, `chrome.tabs`, `chrome.scripting`, `chrome.runtime`
- **DOM APIs**: `MutationObserver`, `execCommand`, synthetic event dispatching

## Security & Privacy

- **100% Local Storage**: All captured conversation capsules are stored exclusively in `chrome.storage.local` on your device.
- **No External Servers**: The extension makes zero network requests to external analytics or third-party servers.
- **Safe Content Rendering**: Conversation previews are rendered using `textContent` to prevent script execution or XSS risks.
- **Unsent Message Injection**: Injected context is deposited into the input composer for user review — messages are never automatically sent.

## Limitations

- **Rendered Content Capture**: Context capture extracts currently rendered/available DOM messages. Unloaded virtualized history or unrendered scroll items are not automatically fetched.
- **Site Layout Updates**: Major DOM restructuring by ChatGPT, Claude, or Gemini may require selector updates in the corresponding adapter.

## Future Improvements

- Infinite-scroll virtualized history extraction
- Import/Export capsules (JSON format)
- Full-text search and tagging system
- Customizable keyboard shortcuts (`Ctrl+Shift+C` capture, `Ctrl+Shift+I` inject)
- Support for additional AI platforms (Perplexity, DeepSeek, Mistral)

