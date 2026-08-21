async function render() {
  const { capsules = [] } = await chrome.storage.local.get("capsules");
  const list = document.getElementById("capsule-list");
  list.innerHTML = "";

  if (!capsules.length) {
    list.innerHTML = '<div class="empty">No capsules saved yet. Open a chat on a supported site and use the floating button to capture one.</div>';
    return;
  }

  capsules.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "capsule-row";
    row.innerHTML = `
      <div class="title">${c.title}</div>
      <div class="meta">${c.sourceSite} \u00b7 ${new Date(c.createdAt).toLocaleString()}</div>
      <button data-action="copy" data-i="${i}">Copy</button>
      <button data-action="delete" data-i="${i}">Delete</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = Number(btn.dataset.i);
      const { capsules = [] } = await chrome.storage.local.get("capsules");
      if (btn.dataset.action === "copy") {
        await navigator.clipboard.writeText(capsules[i].body);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1000);
      } else if (btn.dataset.action === "delete") {
        capsules.splice(i, 1);
        await chrome.storage.local.set({ capsules });
        render();
      }
    });
  });
}

render();
