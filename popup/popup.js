const titleInput = document.getElementById("title");
const captureButton = document.getElementById("capture");
const status = document.getElementById("status");
const capsuleSelect = document.getElementById("capsuleSelect");
const injectButton = document.getElementById("inject");
const deleteButton = document.getElementById("delete");
const capsuleCount = document.getElementById("capsuleCount");
const statusDot = document.getElementById("statusDot");
const conversationPreview = document.getElementById("conversationPreview");

async function loadCapsules() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_CAPSULES",
    });

    console.log("GET_CAPSULES response:", response);

    const capsules = Array.isArray(response?.capsules) ? response.capsules : [];
    capsuleCount.textContent = capsules.length;
    capsuleSelect.innerHTML = "<option value=''>Select a capsule</option>";

    for (const capsule of capsules) {
      const option = document.createElement("option");
      option.value = capsule.id;
      option.textContent = capsule.title || "Untitled";
      capsuleSelect.append(option);
    }
  } catch (error) {
    console.error("Loading capsules failed:", error);
    status.textContent = error.message;
  }
}

captureButton.onclick = async () => {
  status.textContent = "Capturing...";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT",
    });

    console.log("EXTRACT response:", result);

    if (!result?.content) {
      throw new Error(result?.error || "No content found");
    }

    await chrome.runtime.sendMessage({
      type: "SAVE_CAPSULE",
      capsule: {
        id: crypto.randomUUID(),
        title: titleInput.value.trim() || "Untitled",
        source: new URL(tab.url).hostname,
        content: result.content,
        createdAt: Date.now(),
      },
    });
    status.textContent = "Context captured!";
    statusDot.style.backgroundColor = "#55c99a";
    await loadCapsules();
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
    statusDot.style.backgroundColor = "#d06b76";
  }
};

loadCapsules();

function normalizeConversation(content) {
  const lines = content.split("\n");

  const messages = [];

  let currentRole = null;
  let currentText = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.toLowerCase().startsWith("user:")) {
      if (currentRole && currentText.length) {
        messages.push({
          role: currentRole,
          text: currentText.join("\n").trim(),
        });
      }

      currentRole = "user";

      currentText = [trimmed.substring(5).trim()];

      continue;
    }

    if (trimmed.toLowerCase().startsWith("assistant:")) {
      if (currentRole && currentText.length) {
        messages.push({
          role: currentRole,
          text: currentText.join("\n").trim(),
        });
      }

      currentRole = "assistant";

      currentText = [trimmed.substring(10).trim()];

      continue;
    }

    if (trimmed) {
      currentText.push(trimmed);
    }
  }

  if (currentRole && currentText.length) {
    messages.push({
      role: currentRole,
      text: currentText.join("\n").trim(),
    });
  }

  return messages;
}

async function showSelectedCapsule() {
  const selectedId = capsuleSelect.value;

  conversationPreview.innerHTML = "";

  if (!selectedId) {
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "GET_CAPSULES",
  });

  const capsules = Array.isArray(response?.capsules) ? response.capsules : [];

  const capsule = capsules.find((c) => c.id === selectedId);

  if (!capsule) {
    return;
  }

  const messages = normalizeConversation(capsule.content);

  for (const message of messages) {
    const wrapper = document.createElement("div");

    wrapper.className = "message";

    const role = document.createElement("div");

    role.className = "message-role";

    role.textContent = message.role.toUpperCase();

    const text = document.createElement("div");

    text.className = "message-text";

    text.textContent = message.text;

    wrapper.append(role, text);

    conversationPreview.append(wrapper);
  }
}

capsuleSelect.addEventListener("change", showSelectedCapsule);

injectButton.onclick = async () => {
  try {
    const selectedId = capsuleSelect.value;

    if (!selectedId) {
      throw new Error("Select a capsule first");
    }

    // Get capsules
    const response = await chrome.runtime.sendMessage({
      type: "GET_CAPSULES",
    });

    const capsules = Array.isArray(response?.capsules) ? response.capsules : [];

    const capsule = capsules.find((c) => c.id === selectedId);

    if (!capsule) {
      throw new Error("Capsule not found");
    }

    // Current tab
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!tab?.id) {
      throw new Error("No active tab");
    }

    const url = new URL(tab.url);
    const host = url.hostname;

    if (
      host !== "chatgpt.com" &&
      host !== "claude.ai" &&
      host !== "gemini.google.com"
    ) {
      throw new Error("Unsupported website");
    }

    status.textContent = "Injecting...";

    const results = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
      },

      args: [capsule.content, host],

      func: async (text, host) => {
        function findInput() {
          if (host === "claude.ai") {
            return (
              document.querySelector('[contenteditable="true"]') ||
              document.querySelector("textarea")
            );
          }

          if (host === "gemini.google.com") {
            return (
              document.querySelector('[contenteditable="true"]') ||
              document.querySelector("textarea")
            );
          }

          return (
            document.querySelector("textarea") ||
            document.querySelector('[contenteditable="true"]')
          );
        }

        function waitForInput(timeout = 10000) {
          return new Promise((resolve, reject) => {
            const existing = findInput();

            if (existing) {
              resolve(existing);
              return;
            }

            const observer = new MutationObserver(() => {
              const input = findInput();

              if (input) {
                observer.disconnect();
                resolve(input);
              }
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });

            setTimeout(() => {
              observer.disconnect();

              const input = findInput();

              if (input) {
                resolve(input);
              } else {
                reject(new Error("Chat input not found"));
              }
            }, timeout);
          });
        }

        const input = await waitForInput();

        input.focus();

        if (input.tagName === "TEXTAREA") {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value",
          )?.set;

          if (!setter) {
            throw new Error("Textarea setter unavailable");
          }

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

        return {
          success: true,
          host,
          url: location.href,
        };
      },
    });

    console.log("Injection result:", results);

    if (!results?.[0]?.result?.success) {
      throw new Error("Injection failed");
    }

    status.textContent = `Injected: ${capsule.title}`;
    statusDot.style.backgroundColor = "#55c99a";
  } catch (error) {
    console.error("Injection failed:", error);

    status.textContent = `Error: ${error.message}`;
  }
};
deleteButton.onclick = async () => {
  try {
    const selectedId = capsuleSelect.value;

    if (!selectedId) {
      throw new Error("Select a capsule first");
    }

    await chrome.runtime.sendMessage({
      type: "DELETE_CAPSULE",
      id: selectedId,
    });

    status.textContent = "Deleted!";

    await loadCapsules();
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
  }
};
