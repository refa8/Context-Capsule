async function getCapsules() {
  const result = await chrome.storage.local.get("capsules");
  const raw = Array.isArray(result.capsules) ? result.capsules : [];
  return raw.map(normalizeCapsule).filter(Boolean);
}

async function saveCapsule(capsule) {
  const capsules = await getCapsules();
  const normalized = normalizeCapsule(capsule);
  capsules.unshift(normalized);
  await chrome.storage.local.set({ capsules });
  return normalized;
}

async function deleteCapsule(id) {
  const capsules = await getCapsules();
  const updated = capsules.filter((c) => c.id !== id);
  await chrome.storage.local.set({ capsules: updated });
}

function normalizeCapsule(capsule) {
  if (!capsule) return null;
  const normalized = { ...capsule };

  if (!normalized.id) {
    normalized.id = crypto.randomUUID();
  }
  if (!normalized.title) {
    normalized.title = "Untitled Capsule";
  }
  if (!normalized.source) {
    normalized.source = "unknown";
  }
  if (!normalized.version) {
    normalized.version = 1;
  }
  if (typeof normalized.createdAt === "string") {
    normalized.createdAt = Date.parse(normalized.createdAt) || Date.now();
  } else if (!normalized.createdAt) {
    normalized.createdAt = Date.now();
  }

  if (Array.isArray(normalized.messages) && normalized.messages.length > 0) {
    normalized.messages = normalized.messages.map((m) => ({
      role: m.role || "conversation",
      text: m.text || "",
    }));
  } else if (typeof normalized.content === "string" && normalized.content.trim()) {
    const parsed = parseContentToMessages(normalized.content);
    normalized.messages =
      parsed.length > 0
        ? parsed
        : [{ role: "conversation", text: normalized.content.trim() }];
  } else {
    normalized.messages = [{ role: "conversation", text: "" }];
  }

  return normalized;
}

function parseContentToMessages(content) {
  if (!content) return [];
  const lines = content.split("\n");
  const messages = [];
  let currentRole = null;
  let currentText = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    let newRole = null;
    let textStart = 0;

    if (
      lower.startsWith("### you") ||
      lower.startsWith("[you]:") ||
      lower.startsWith("user:") ||
      lower.startsWith("[user]:")
    ) {
      newRole = "user";
      textStart = trimmed.indexOf(":") > -1 ? trimmed.indexOf(":") + 1 : 7;
    } else if (
      lower.startsWith("### assistant") ||
      lower.startsWith("[assistant]:") ||
      lower.startsWith("assistant:")
    ) {
      newRole = "assistant";
      textStart = trimmed.indexOf(":") > -1 ? trimmed.indexOf(":") + 1 : 13;
    } else if (
      lower.startsWith("### conversation") ||
      lower.startsWith("[conversation]:") ||
      lower.startsWith("conversation:")
    ) {
      newRole = "conversation";
      textStart = trimmed.indexOf(":") > -1 ? trimmed.indexOf(":") + 1 : 16;
    }

    if (newRole) {
      if (currentRole && currentText.length > 0) {
        messages.push({
          role: currentRole,
          text: currentText.join("\n").trim(),
        });
      }
      currentRole = newRole;
      const initialText = trimmed.substring(textStart).trim();
      currentText = initialText ? [initialText] : [];
    } else if (currentRole) {
      currentText.push(line);
    }
  }

  if (currentRole && currentText.length > 0) {
    messages.push({
      role: currentRole,
      text: currentText.join("\n").trim(),
    });
  }

  return messages;
}


