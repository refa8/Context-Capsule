// content.js — runs on every matched chat site.
// Adds a small floating button that lets you:
//   Capture -> summarize current chat into a capsule, save to storage
//   Inject  -> pick a saved capsule and drop it into the current input box

(function () {
  const adapter = CapsuleAdapters.detect();
  if (!adapter) return;

  const btn = document.createElement("button");
  btn.id = "capsule-fab";
  btn.textContent = "\u{1F4E6}"; // package emoji
  btn.title = "Context Capsule";
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "capsule-panel";
  panel.style.display = "none";
  panel.innerHTML = `
    <div class="capsule-header">Context Capsule</div>
    <button id="capsule-capture-btn">Capture this chat</button>
    <div class="capsule-list-label">Saved capsules — click to insert</div>
    <div id="capsule-list"></div>
  `;
  document.body.appendChild(panel);

  btn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    if (panel.style.display === "block") refreshList();
  });

  document.getElementById("capsule-capture-btn").addEventListener("click", async () => {
    const messages = adapter.extractMessages();
    if (!messages.length) {
      alert("No messages found on this page — the site's layout may have changed.");
      return;
    }
    const capsule = buildCapsule(messages);
    const title = prompt("Name this capsule:", capsule.suggestedTitle);
    if (title === null) return; // cancelled
    capsule.title = title || capsule.suggestedTitle;
    await saveCapsule(capsule);
    refreshList();
  });

  function buildCapsule(messages) {
    // MVP: no LLM summarization call yet — just package the raw exchange.
    // Trim aggressively so it stays pasteable: last N turns, capped length.
    const MAX_TURNS = 12;
    const MAX_CHARS = 6000;
    const trimmed = messages.slice(-MAX_TURNS);
    let body = trimmed.map((m) => `[${m.role}] ${m.text}`).join("\n\n");
    if (body.length > MAX_CHARS) {
      body = body.slice(body.length - MAX_CHARS);
    }
    const firstUserLine =
      messages.find((m) => m.role === "user")?.text.slice(0, 60) || "Untitled session";
    return {
      id: crypto.randomUUID(),
      suggestedTitle: firstUserLine,
      sourceSite: adapter.name,
      createdAt: new Date().toISOString(),
      body,
    };
  }

  async function saveCapsule(capsule) {
    const { capsules = [] } = await chrome.storage.local.get("capsules");
    capsules.unshift(capsule);
    await chrome.storage.local.set({ capsules });
  }

  async function refreshList() {
    const { capsules = [] } = await chrome.storage.local.get("capsules");
    const list = document.getElementById("capsule-list");
    list.innerHTML = "";
    if (!capsules.length) {
      list.innerHTML = '<div class="capsule-empty">No capsules saved yet.</div>';
      return;
    }
    capsules.forEach((c) => {
      const item = document.createElement("div");
      item.className = "capsule-item";
      item.innerHTML = `
        <div class="capsule-item-title">${escapeHtml(c.title)}</div>
        <div class="capsule-item-meta">${c.sourceSite} \u00b7 ${new Date(c.createdAt).toLocaleDateString()}</div>
      `;
      item.addEventListener("click", () => insertCapsule(c));
      list.appendChild(item);
    });
  }

  function insertCapsule(capsule) {
    const box = adapter.getInputBox();
    if (!box) {
      alert("Couldn't find the chat input box on this page.");
      return;
    }
    const header = `Context from a previous session ("${capsule.title}", captured on ${capsule.sourceSite}):\n\n`;
    adapter.insertText(box, header + capsule.body + "\n\n---\n\n");
    panel.style.display = "none";
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.innerText = s;
    return d.innerHTML;
  }
})();
