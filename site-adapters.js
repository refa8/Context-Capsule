// site-adapters.js
// One adapter per target site. Each adapter knows how to:
//  - find the message list and pull out {role, text} pairs
//  - find the chat input box
//  - insert text into that input box in a way the site's own JS framework notices
//
// This is the part that breaks when a site redesigns its UI — keep it isolated
// here so fixing one site never touches the others.

const CapsuleAdapters = {
  detect() {
    const host = window.location.hostname;
    if (host.includes("claude.ai")) return CapsuleAdapters.claude;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return CapsuleAdapters.chatgpt;
    if (host.includes("gemini.google.com")) return CapsuleAdapters.gemini;
    return null;
  },

  claude: {
    name: "claude",
    extractMessages() {
      // Claude.ai messages live in [data-testid="user-message"] and the assistant
      // response blocks. Selectors below are best-effort and may need updating
      // if Claude's DOM changes.
      const nodes = document.querySelectorAll(
        '[data-testid="user-message"], [data-testid="chat-message"], .font-user-message, .font-claude-message'
      );
      const messages = [];
      nodes.forEach((n) => {
        const text = n.innerText.trim();
        if (!text) return;
        const isUser =
          n.matches('[data-testid="user-message"]') || n.classList.contains("font-user-message");
        messages.push({ role: isUser ? "user" : "assistant", text });
      });
      return messages;
    },
    getInputBox() {
      return document.querySelector('div[contenteditable="true"]');
    },
    insertText(box, text) {
      box.focus();
      // Claude's input is a contenteditable div driven by a rich-text framework;
      // execCommand is the most reliable way to trigger its internal state update.
      document.execCommand("insertText", false, text);
    },
  },

  chatgpt: {
    name: "chatgpt",
    extractMessages() {
      const nodes = document.querySelectorAll('[data-message-author-role]');
      const messages = [];
      nodes.forEach((n) => {
        const role = n.getAttribute("data-message-author-role");
        const text = n.innerText.trim();
        if (!text) return;
        messages.push({ role, text });
      });
      return messages;
    },
    getInputBox() {
      return document.querySelector("#prompt-textarea") || document.querySelector('div[contenteditable="true"]');
    },
    insertText(box, text) {
      box.focus();
      document.execCommand("insertText", false, text);
    },
  },

  gemini: {
    name: "gemini",
    extractMessages() {
      // Placeholder — Gemini's DOM structure needs inspection before this works.
      const nodes = document.querySelectorAll(".conversation-container");
      const messages = [];
      nodes.forEach((n) => {
        const text = n.innerText.trim();
        if (!text) return;
        messages.push({ role: "unknown", text });
      });
      return messages;
    },
    getInputBox() {
      return document.querySelector("div.ql-editor");
    },
    insertText(box, text) {
      box.focus();
      document.execCommand("insertText", false, text);
    },
  },
};
