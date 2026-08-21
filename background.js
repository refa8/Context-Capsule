// background.js — service worker.
// Currently minimal: storage is handled directly from content.js and popup.js.
// This is the place to add, later:
//   - a proper LLM summarization call (chat.completions-style) to turn raw
//     captured messages into a tighter capsule instead of the raw-text MVP
//   - cross-device sync (chrome.storage.sync instead of .local) if capsules
//     should follow you across machines
//   - context menu integration ("Capture selection as capsule")

chrome.runtime.onInstalled.addListener(() => {
  console.log("Context Capsule installed.");
});
