// content/adapters.js — Site Adapters for ChatGPT, Claude, and Gemini

(function () {
  function isElementVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function waitForComposer(getComposerFn, timeout = 5000) {
    const existing = getComposerFn();
    if (existing && document.contains(existing) && isElementVisible(existing)) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      let observer = null;
      let timer = null;
      let interval = null;

      const cleanup = () => {
        if (observer) observer.disconnect();
        if (timer) clearTimeout(timer);
        if (interval) clearInterval(interval);
      };

      const check = () => {
        if (resolved) return;
        const el = getComposerFn();
        if (el && document.contains(el) && isElementVisible(el)) {
          resolved = true;
          cleanup();
          resolve(el);
        }
      };

      interval = setInterval(check, 100);

      observer = new MutationObserver(check);
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      timer = setTimeout(() => {
        if (resolved) return;
        cleanup();
        const finalCheck = getComposerFn();
        if (finalCheck) {
          resolve(finalCheck);
        } else {
          reject(new Error("Composer input not found after page transition."));
        }
      }, timeout);
    });
  }

  function injectTextIntoElement(input, text) {
    input.focus();

    if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
      const setter =
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set ||
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

      if (setter) {
        setter.call(input, text);
      } else {
        input.value = text;
      }

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text,
        })
      );
    } else {
      // Contenteditable (ProseMirror, Slate, standard)
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(input);
      selection.removeAllRanges();
      selection.addRange(range);

      let inserted = false;
      try {
        inserted = document.execCommand("insertText", false, text);
      } catch (e) {
        inserted = false;
      }

      if (!inserted || !input.textContent.includes(text.slice(0, 10))) {
        input.textContent = text;

        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: text,
          })
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    input.focus();
  }

  function filterNoiseLines(text) {
    if (!text) return "";
    const noiseLinePatterns = [
      /^share$/i,
      /^loading older messages/i,
      /^chatgpt can make mistakes/i,
      /^copy$/i,
      /^copied/i,
      /^retry$/i,
      /^edit$/i,
      /^temporary chat$/i,
      /^model:\s+/i,
      /^regenerate$/i,
      /^good response$/i,
      /^bad response$/i,
      /^read aloud$/i,
    ];

    const lines = text.split("\n");
    const cleanLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true; // Keep blank lines for spacing!
      return !noiseLinePatterns.some((pattern) => pattern.test(trimmed));
    });

    return cleanLines.join("\n").trim();
  }

  function extractCleanMessageText(el) {
    if (!el) return "";
    const clone = el.cloneNode(true);

    const noiseSelectors = [
      "button",
      "svg",
      ".sr-only",
      ".select-none",
      '[aria-label="Copy"]',
      '[aria-label="Good response"]',
      '[aria-label="Bad response"]',
      '[aria-label="Read aloud"]',
      ".text-xs",
      "form",
      "nav",
      "header",
      "footer",
      ".model-response-footer",
      ".user-query-footer",
    ];

    noiseSelectors.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((n) => n.remove());
    });

    const raw = clone.innerText || clone.textContent || "";
    return filterNoiseLines(raw);
  }

  function formatFullDate(timestamp) {
    if (!timestamp) return "";
    const time = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
    if (isNaN(time)) return "";
    return new Date(time).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function capsuleToText(capsuleOrMessages) {
    if (!capsuleOrMessages) return "";

    let capsule = capsuleOrMessages;
    if (Array.isArray(capsuleOrMessages)) {
      capsule = { messages: capsuleOrMessages };
    }

    const title = capsule.title || "Untitled Capsule";
    let source = capsule.source || "AI Session";
    if (source.toLowerCase().includes("chatgpt")) source = "ChatGPT";
    else if (source.toLowerCase().includes("claude")) source = "Claude";
    else if (source.toLowerCase().includes("gemini")) source = "Gemini";

    const dateStr = formatFullDate(capsule.createdAt);
    const dateLine = dateStr ? `Captured: ${dateStr}\n` : "";

    let result = `[Context Capsule: ${title}]\n\nSource: ${source}\n${dateLine}\n`;

    let messages = capsule.messages;
    if (!Array.isArray(messages) && typeof capsule.content === "string") {
      return result + filterNoiseLines(capsule.content);
    }

    if (Array.isArray(messages) && messages.length > 0) {
      const formattedTurns = messages
        .map((m) => {
          if (!m || !m.text) return "";
          const roleHeader =
            m.role === "user"
              ? "--- USER ---"
              : m.role === "assistant"
              ? "--- ASSISTANT ---"
              : "--- CONVERSATION ---";
          return `${roleHeader}\n${m.text}`;
        })
        .filter(Boolean)
        .join("\n\n");
      return result + formattedTurns;
    }

    return capsule.content ? result + filterNoiseLines(capsule.content) : result;
  }


  // =========================================================
  // ChatGPT Adapter
  // =========================================================
  const ChatGPTAdapter = {
    name: "chatgpt",

    async getMessages() {
      const nodes = document.querySelectorAll("[data-message-author-role]");
      const messages = [];

      if (nodes.length > 0) {
        nodes.forEach((n) => {
          const rawRole = n.getAttribute("data-message-author-role");
          if (rawRole !== "user" && rawRole !== "assistant") return;

          const role = rawRole;
          const textEl =
            n.querySelector(".markdown") ||
            n.querySelector(".whitespace-pre-wrap") ||
            n;
          const text = extractCleanMessageText(textEl);

          if (text) {
            messages.push({ role, text });
          }
        });

        if (messages.length > 0) {
          return messages;
        }
      }

      const articles = document.querySelectorAll("article");
      if (articles.length > 0) {
        articles.forEach((art) => {
          const userNode = art.querySelector('[data-message-author-role="user"]');
          const assistantNode = art.querySelector('[data-message-author-role="assistant"]');

          let role = "assistant";
          let targetEl = art;

          if (userNode) {
            role = "user";
            targetEl = userNode;
          } else if (assistantNode) {
            role = "assistant";
            targetEl = assistantNode;
          }

          const text = extractCleanMessageText(targetEl);
          if (text) {
            messages.push({ role, text });
          }
        });

        if (messages.length > 0) {
          return messages;
        }
      }

      const main = document.querySelector("main");
      const text = extractCleanMessageText(main || document.body);
      if (!text) return [];

      return [{ role: "conversation", text }];
    },

    async inject(text) {
      const findComposer = () => {
        return (
          document.querySelector("#prompt-textarea") ||
          document.querySelector('textarea[tabindex="0"]') ||
          document.querySelector("textarea") ||
          document.querySelector('div[contenteditable="true"]') ||
          document.querySelector(".ProseMirror")
        );
      };

      const input = await waitForComposer(findComposer, 5000);
      if (!input) {
        throw new Error("ChatGPT input not found.");
      }

      injectTextIntoElement(input, text);
      return true;
    },
  };

  // =========================================================
  // Claude Adapter
  // =========================================================
  const ClaudeAdapter = {
    name: "claude",

    async getMessages() {
      const elements = document.querySelectorAll(
        '[data-testid="user-message"], [data-testid="chat-message"], [data-testid="assistant-message"], .font-user-message, .font-claude-message'
      );

      const messages = [];
      if (elements.length > 0) {
        elements.forEach((el) => {
          const isUser =
            el.matches('[data-testid="user-message"]') ||
            el.classList.contains("font-user-message");
          const role = isUser ? "user" : "assistant";

          const text = extractCleanMessageText(el);
          if (text) {
            messages.push({ role, text });
          }
        });

        if (messages.length > 0) {
          return messages;
        }
      }

      const main = document.querySelector("main");
      const text = extractCleanMessageText(main || document.body);
      if (!text) return [];

      return [{ role: "conversation", text }];
    },

    async inject(text) {
      const findComposer = () => {
        return (
          document.querySelector('fieldset div[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"]') ||
          document.querySelector("textarea")
        );
      };

      const input = await waitForComposer(findComposer, 5000);
      if (!input) {
        throw new Error("Claude input not found.");
      }

      injectTextIntoElement(input, text);
      return true;
    },
  };

  // =========================================================
  // Gemini Adapter
  // =========================================================
  const GeminiAdapter = {
    name: "gemini",

    async getMessages() {
      const elements = document.querySelectorAll("user-query, model-response");
      const messages = [];

      if (elements.length > 0) {
        elements.forEach((el) => {
          const role = el.matches("user-query") ? "user" : "assistant";
          const text = extractCleanMessageText(el);
          if (text) {
            messages.push({ role, text });
          }
        });

        if (messages.length > 0) {
          return messages;
        }
      }

      const main = document.querySelector("main");
      const text = extractCleanMessageText(main || document.body);
      if (!text) return [];

      return [{ role: "conversation", text }];
    },

    async inject(text) {
      const findComposer = () => {
        return (
          document.querySelector('div.ql-editor[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"]') ||
          document.querySelector("textarea")
        );
      };

      const input = await waitForComposer(findComposer, 5000);
      if (!input) {
        throw new Error("Gemini input not found.");
      }

      injectTextIntoElement(input, text);
      return true;
    },
  };

  // =========================================================
  // Detector
  // =========================================================
  function getAdapter() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
      return ChatGPTAdapter;
    }
    if (host.includes("claude.ai")) {
      return ClaudeAdapter;
    }
    if (host.includes("gemini.google.com")) {
      return GeminiAdapter;
    }
    return null;
  }

  // Export to global scope for content scripts
  globalThis.getAdapter = getAdapter;
  globalThis.ChatGPTAdapter = ChatGPTAdapter;
  globalThis.ClaudeAdapter = ClaudeAdapter;
  globalThis.GeminiAdapter = GeminiAdapter;
  globalThis.capsuleToText = capsuleToText;
  globalThis.waitForComposer = waitForComposer;
  globalThis.injectTextIntoElement = injectTextIntoElement;
  globalThis.extractCleanMessageText = extractCleanMessageText;
  globalThis.filterNoiseLines = filterNoiseLines;
})();


