// content/content.js — Content Script Listener for Context Capsule

if (!globalThis.__contextCapsuleLoaded) {
  globalThis.__contextCapsuleLoaded = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXTRACT") {
      (async () => {
        try {
          const adapter = typeof getAdapter === "function" ? getAdapter() : null;

          if (!adapter) {
            sendResponse({
              success: false,
              error: "Unsupported website. Supported: ChatGPT, Claude, and Gemini.",
            });
            return;
          }

          const messages = await adapter.getMessages();

          if (!messages || messages.length === 0) {
            sendResponse({
              success: false,
              error: "No conversation content found on this page.",
            });
            return;
          }

          sendResponse({
            success: true,
            source: adapter.name,
            messages: messages,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message || "Failed to extract conversation context.",
          });
        }
      })();

      return true; // Keep message channel open for async response
    }

    if (message.type === "INJECT") {
      (async () => {
        try {
          const adapter = typeof getAdapter === "function" ? getAdapter() : null;

          if (!adapter) {
            sendResponse({
              success: false,
              error: "Unsupported website. Supported: ChatGPT, Claude, and Gemini.",
            });
            return;
          }

          let textToInject = message.text;
          if (!textToInject && message.capsule) {
            textToInject =
              typeof capsuleToText === "function"
                ? capsuleToText(message.capsule)
                : message.capsule.content || "";
          }

          if (!textToInject) {
            sendResponse({
              success: false,
              error: "No context text available to inject.",
            });
            return;
          }

          await adapter.inject(textToInject);

          sendResponse({
            success: true,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message || "Failed to inject context into chat.",
          });
        }
      })();

      return true; // Keep message channel open for async response
    }
  });
}

