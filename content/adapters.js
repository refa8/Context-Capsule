async function captureFullConversation() {
  const scrollContainer = document.scrollingElement || document.documentElement;

  const originalPosition = scrollContainer.scrollTop;

  const chunks = [];
  const seen = new Set();

  // Start from the top so lazy-loaded older messages appear
  scrollContainer.scrollTo({
    top: 0,
    behavior: "instant",
  });

  await new Promise((resolve) => setTimeout(resolve, 800));

  let previousTop = -1;

  while (scrollContainer.scrollTop !== previousTop) {
    previousTop = scrollContainer.scrollTop;

    const main = document.querySelector("main");

    const text = (main?.innerText || document.body?.innerText || "").trim();

    if (text && !seen.has(text)) {
      seen.add(text);
      chunks.push(text);
    }

    scrollContainer.scrollBy({
      top: Math.max(400, window.innerHeight * 0.8),
      behavior: "instant",
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Restore user's position
  scrollContainer.scrollTo({
    top: originalPosition,
    behavior: "instant",
  });

  return chunks;
}

function getAdapter() {
  const host = location.hostname;

  // =========================
  // ChatGPT
  // =========================
  if (host === "chatgpt.com") {
    function getAdapter() {
      const host = location.hostname;

      // =========================================================
      // CHATGPT
      // =========================================================
      if (host === "chatgpt.com") {
        return {
          name: "chatgpt",

          async getMessages() {
            const chunks = await captureFullConversation();

            if (!chunks.length) {
              return [];
            }

            return [
              {
                role: "conversation",
                text: chunks.join("\n\n"),
              },
            ];
          },

          inject(text) {
            const input =
              document.querySelector("textarea") ||
              document.querySelector('[contenteditable="true"]');

            if (!input) {
              throw new Error("ChatGPT input not found");
            }

            if (input.tagName === "TEXTAREA") {
              const setter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                "value",
              ).set;

              setter.call(input, text);
            } else {
              input.textContent = text;
            }

            input.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: text,
              }),
            );

            input.focus();
          },
        };
      }

      // =========================================================
      // CLAUDE
      // =========================================================
      if (host === "claude.ai") {
        return {
          name: "claude",

          getMessages() {
            // Try Claude message containers
            const elements = [
              ...document.querySelectorAll('[data-testid="chat-message"]'),
            ];

            if (elements.length > 0) {
              const messages = elements
                .map((el) => {
                  const text = el.innerText.trim();

                  if (!text) {
                    return null;
                  }

                  return {
                    role: "conversation",
                    text,
                  };
                })
                .filter(Boolean);

              if (messages.length > 0) {
                return messages;
              }
            }

            // Fallback: capture main conversation
            const main = document.querySelector("main");

            const text = main
              ? main.innerText.trim()
              : document.body.innerText.trim();

            if (!text) {
              return [];
            }

            return [
              {
                role: "conversation",
                text,
              },
            ];
          },

          inject(text) {
            const input =
              document.querySelector('div[contenteditable="true"]') ||
              document.querySelector('[contenteditable="true"]') ||
              document.querySelector("textarea");

            if (!input) {
              throw new Error("Claude input not found");
            }

            input.focus();

            if (input.tagName === "TEXTAREA") {
              const setter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                "value",
              ).set;

              setter.call(input, text);
            } else {
              input.textContent = text;
            }

            input.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: text,
              }),
            );

            input.dispatchEvent(
              new Event("change", {
                bubbles: true,
              }),
            );

            input.focus();
          },
        };
      }

      // =========================================================
      // GEMINI
      // =========================================================
      if (host === "gemini.google.com") {
        return {
          name: "gemini",

          getMessages() {
            // Gemini's semantic conversation elements
            const elements = [
              ...document.querySelectorAll("user-query, model-response"),
            ];

            if (elements.length > 0) {
              const messages = elements
                .map((el) => {
                  const text = el.innerText.trim();

                  if (!text) {
                    return null;
                  }

                  return {
                    role: el.matches("user-query") ? "user" : "assistant",
                    text,
                  };
                })
                .filter(Boolean);

              if (messages.length > 0) {
                return messages;
              }
            }

            // Fallback
            const main = document.querySelector("main");

            const text = main
              ? main.innerText.trim()
              : document.body.innerText.trim();

            if (!text) {
              return [];
            }

            return [
              {
                role: "conversation",
                text,
              },
            ];
          },

          inject(text) {
            const input =
              document.querySelector('[contenteditable="true"]') ||
              document.querySelector("textarea");

            if (!input) {
              throw new Error("Gemini input not found");
            }

            input.focus();

            if (input.tagName === "TEXTAREA") {
              const setter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                "value",
              ).set;

              setter.call(input, text);
            } else {
              input.textContent = text;
            }

            input.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: text,
              }),
            );

            input.dispatchEvent(
              new Event("change", {
                bubbles: true,
              }),
            );

            input.focus();
          },
        };
      }

      // =========================================================
      // UNSUPPORTED
      // =========================================================

      return null;
    }
    return {
      name: "chatgpt",

      getMessages() {
        const main = document.querySelector("main");
        const text = main ? main.innerText.trim() : "";

        if (!text) {
          return [];
        }

        return [
          {
            role: "conversation",
            text: text,
          },
        ];
      },

      inject(text) {
        const input =
          document.querySelector("textarea") ||
          document.querySelector('[contenteditable="true"]');

        if (!input) {
          throw new Error("Chat input not found");
        }

        input.focus();

        if (input.tagName === "TEXTAREA") {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value",
          ).set;

          setter.call(input, text);

          input.dispatchEvent(
            new Event("input", {
              bubbles: true,
            }),
          );

          input.dispatchEvent(
            new Event("change", {
              bubbles: true,
            }),
          );
        } else {
          const selection = window.getSelection();
          const range = document.createRange();

          range.selectNodeContents(input);
          selection.removeAllRanges();
          selection.addRange(range);

          const inserted = document.execCommand("insertText", false, text);

          if (!inserted) {
            input.textContent = text;

            input.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: text,
              }),
            );
          }
        }

        input.focus();
      },
      //
    };
  }

  // =========================
  // Claude
  // =========================
  if (host === "claude.ai") {
    return {
      name: "claude",

      getMessages() {
        const elements = [
          ...document.querySelectorAll('[data-testid="chat-message"]'),
          ...document.querySelectorAll('[data-testid="user-message"]'),
          ...document.querySelectorAll('[data-testid="assistant-message"]'),
        ];

        const messages = elements
          .map((el) => {
            const text = el.innerText?.trim();

            if (!text) {
              return null;
            }

            return {
              role: "conversation",
              text,
            };
          })
          .filter(Boolean);

        if (messages.length > 0) {
          return messages;
        }

        const text = document.body?.innerText?.trim() || "";

        if (!text) {
          return [];
        }

        return [
          {
            role: "conversation",
            text,
          },
        ];
      },

      inject(text) {
        const input =
          document.querySelector('[contenteditable="true"]') ||
          document.querySelector("textarea");

        if (!input) {
          throw new Error("Claude input not found");
        }

        input.focus();

        if (input.tagName === "TEXTAREA") {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value",
          ).set;

          setter.call(input, text);
        } else {
          input.textContent = text;
        }

        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: text,
          }),
        );

        input.dispatchEvent(
          new Event("change", {
            bubbles: true,
          }),
        );

        input.focus();
      },
    };
  }

  // =========================
  // Gemini
  // =========================
  if (host === "gemini.google.com") {
    return {
      name: "gemini",

      getMessages() {
        const elements = [
          ...document.querySelectorAll("user-query, model-response"),
        ];

        return elements
          .map(function (el) {
            return {
              role: el.matches("user-query") ? "user" : "assistant",
              text: el.innerText.trim(),
            };
          })
          .filter(function (m) {
            return m.text;
          });
      },

      inject(text) {
        const input = document.querySelector('[contenteditable="true"]');

        if (!input) {
          throw new Error("Gemini input not found");
        }

        input.textContent = text;

        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: text,
          }),
        );

        input.focus();
      },
    };
  }

  return null;
}
