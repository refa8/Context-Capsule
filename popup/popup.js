// popup/popup.js — UI Controller for Context Capsule

const titleInput = document.getElementById("titleInput");
const captureBtn = document.getElementById("captureBtn");
const capsuleSelect = document.getElementById("capsuleSelect");
const capsuleCountBadge = document.getElementById("capsuleCountBadge");
const capsuleDocument = document.getElementById("capsuleDocument");
const injectBtn = document.getElementById("injectBtn");
const deleteBtn = document.getElementById("deleteBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

let loadedCapsules = [];

function updateStatus(text, state = "ready") {
  statusText.textContent = text;
  statusDot.className = `status-dot ${state}`;
}

function formatSource(source) {
  if (!source) return "Unknown";
  const s = source.toLowerCase();
  if (s.includes("chatgpt")) return "ChatGPT";
  if (s.includes("claude")) return "Claude";
  if (s.includes("gemini")) return "Gemini";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const time = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (isNaN(time)) return "";

  const now = Date.now();
  const seconds = Math.floor((now - time) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return "Yesterday";

  const date = new Date(time);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

async function loadCapsules(selectId = null) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_CAPSULES",
    });

    loadedCapsules = Array.isArray(response?.capsules) ? response.capsules : [];
    capsuleCountBadge.textContent = loadedCapsules.length;

    const previousValue = selectId || capsuleSelect.value;
    capsuleSelect.innerHTML = "<option value=''>Select a saved capsule...</option>";

    for (const capsule of loadedCapsules) {
      const option = document.createElement("option");
      option.value = capsule.id;

      const sourceLabel = formatSource(capsule.source);
      const msgCount = Array.isArray(capsule.messages) ? capsule.messages.length : 0;
      const timeLabel = formatTimeAgo(capsule.createdAt);

      option.textContent = `${capsule.title || "Untitled"} (${sourceLabel} · ${msgCount} msgs · ${timeLabel})`;
      capsuleSelect.appendChild(option);
    }

    if (previousValue && loadedCapsules.some((c) => c.id === previousValue)) {
      capsuleSelect.value = previousValue;
    } else if (loadedCapsules.length > 0) {
      capsuleSelect.value = loadedCapsules[0].id;
    }

    renderCapsuleDocument();
  } catch (error) {
    console.error("Failed to load capsules:", error);
    updateStatus(`Error: ${error.message}`, "error");
  }
}

function renderCapsuleDocument() {
  const selectedId = capsuleSelect.value;
  capsuleDocument.innerHTML = "";

  if (!selectedId) {
    injectBtn.disabled = true;
    deleteBtn.disabled = true;

    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Select or capture a capsule to view document";
    capsuleDocument.appendChild(empty);
    return;
  }

  const capsule = loadedCapsules.find((c) => c.id === selectedId);

  if (!capsule) {
    injectBtn.disabled = true;
    deleteBtn.disabled = true;
    return;
  }

  injectBtn.disabled = false;
  deleteBtn.disabled = false;

  const messages = Array.isArray(capsule.messages) ? capsule.messages : [];
  const sourceLabel = formatSource(capsule.source);
  const dateLabel = formatFullDate(capsule.createdAt);

  // Document Title Block
  const titleBlock = document.createElement("div");
  titleBlock.className = "doc-title-block";

  const mainLabel = document.createElement("div");
  mainLabel.className = "doc-main-label";
  mainLabel.textContent = "CONTEXT CAPSULE";

  const titleEl = document.createElement("h1");
  titleEl.className = "doc-title";
  titleEl.textContent = capsule.title || "Untitled Capsule";

  const metaEl = document.createElement("div");
  metaEl.className = "doc-meta";
  metaEl.textContent = `${sourceLabel} · ${messages.length} ${
    messages.length === 1 ? "message" : "messages"
  }${dateLabel ? " · Captured " + dateLabel : ""}`;

  titleBlock.appendChild(mainLabel);
  titleBlock.appendChild(titleEl);
  titleBlock.appendChild(metaEl);

  capsuleDocument.appendChild(titleBlock);

  // Conversation Section Heading
  const sectionHeading = document.createElement("div");
  sectionHeading.className = "doc-section-heading";
  sectionHeading.textContent = "CONVERSATION";
  capsuleDocument.appendChild(sectionHeading);

  // Conversation Messages
  for (const message of messages) {
    const turn = document.createElement("div");
    turn.className = "doc-turn";

    const roleLabel = document.createElement("div");
    const roleClass =
      message.role === "user"
        ? "user"
        : message.role === "assistant"
        ? "assistant"
        : "conversation";
    roleLabel.className = `doc-role-label ${roleClass}`;
    roleLabel.textContent =
      message.role === "user"
        ? "YOU"
        : message.role === "assistant"
        ? "ASSISTANT"
        : "CONVERSATION";

    const contentNode = renderFormattedMessageText(message.text || "");

    turn.appendChild(roleLabel);
    turn.appendChild(contentNode);

    capsuleDocument.appendChild(turn);
  }
}

function renderFormattedMessageText(text) {
  const container = document.createElement("div");
  container.className = "doc-text-container";

  if (!text) return container;

  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore) {
      container.appendChild(createProseNode(textBefore));
    }

    const lang = match[1];
    const codeContent = match[2];

    const pre = document.createElement("pre");
    pre.className = "doc-code-block";

    if (lang) {
      const langTag = document.createElement("div");
      langTag.className = "code-lang-tag";
      langTag.textContent = lang.toUpperCase();
      pre.appendChild(langTag);
    }

    const code = document.createElement("code");
    code.textContent = codeContent.trim(); // strictly textContent for security

    pre.appendChild(code);
    container.appendChild(pre);

    lastIndex = match.index + match[0].length;
  }

  const textAfter = text.slice(lastIndex);
  if (textAfter) {
    container.appendChild(createProseNode(textAfter));
  }

  return container;
}

function createProseNode(text) {
  const div = document.createElement("div");
  div.className = "doc-prose";
  div.textContent = text; // strictly textContent for security & spatial formatting
  return div;
}


capsuleSelect.addEventListener("change", renderCapsuleDocument);

captureBtn.onclick = async () => {
  updateStatus("Capturing...", "loading");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    if (!tab.url || !tab.url.startsWith("http")) {
      throw new Error("Unsupported webpage.");
    }

    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, {
        type: "EXTRACT",
      });
    } catch (e) {
      console.log("Direct message failed, dynamically injecting scripts...", e);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/adapters.js", "content/content.js"],
      });
      result = await chrome.tabs.sendMessage(tab.id, {
        type: "EXTRACT",
      });
    }

    if (!result || !result.success) {
      throw new Error(result?.error || "Failed to extract conversation content.");
    }

    const title = titleInput.value.trim() || "Untitled Capsule";
    const newCapsule = {
      id: crypto.randomUUID(),
      title: title,
      source: result.source || new URL(tab.url).hostname,
      messages: result.messages || [],
      createdAt: Date.now(),
      version: 1,
    };

    const saveResponse = await chrome.runtime.sendMessage({
      type: "SAVE_CAPSULE",
      capsule: newCapsule,
    });

    if (saveResponse && !saveResponse.success) {
      throw new Error(saveResponse.error || "Failed to save capsule.");
    }

    titleInput.value = "";
    updateStatus("Captured successfully!", "ready");
    await loadCapsules(newCapsule.id);
  } catch (error) {
    console.error("Capture error:", error);
    updateStatus(`Error: ${error.message}`, "error");
  }
};

injectBtn.onclick = async () => {
  try {
    const selectedId = capsuleSelect.value;
    if (!selectedId) {
      throw new Error("Select a capsule first.");
    }

    const capsule = loadedCapsules.find((c) => c.id === selectedId);
    if (!capsule) {
      throw new Error("Selected capsule not found.");
    }

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    const url = new URL(tab.url);
    const host = url.hostname;

    if (
      !host.includes("chatgpt.com") &&
      !host.includes("chat.openai.com") &&
      !host.includes("claude.ai") &&
      !host.includes("gemini.google.com")
    ) {
      throw new Error("Unsupported website. Open ChatGPT, Claude, or Gemini.");
    }

    updateStatus("Injecting context...", "loading");

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "INJECT",
        capsule: capsule,
      });
    } catch (e) {
      console.log("Direct message failed, dynamically injecting script...", e);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/adapters.js", "content/content.js"],
      });
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "INJECT",
        capsule: capsule,
      });
    }

    if (!response || !response.success) {
      throw new Error(response?.error || "Injection failed.");
    }

    updateStatus(`Injected: ${capsule.title}`, "ready");
  } catch (error) {
    console.error("Injection error:", error);
    updateStatus(`Error: ${error.message}`, "error");
  }
};

deleteBtn.onclick = async () => {
  try {
    const selectedId = capsuleSelect.value;
    if (!selectedId) {
      throw new Error("Select a capsule to delete.");
    }

    updateStatus("Deleting...", "loading");

    const response = await chrome.runtime.sendMessage({
      type: "DELETE_CAPSULE",
      id: selectedId,
    });

    if (response && !response.success) {
      throw new Error(response.error || "Failed to delete capsule.");
    }

    updateStatus("Capsule deleted.", "ready");
    await loadCapsules();
  } catch (error) {
    console.error("Delete error:", error);
    updateStatus(`Error: ${error.message}`, "error");
  }
};

// Initial load
loadCapsules();


