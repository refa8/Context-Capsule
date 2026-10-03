async function getCapsules() {
  const result = await chrome.storage.local.get("capsules");
  return Array.isArray(result.capsules) ? result.capsules : [];
}

async function saveCapsule(capsule) {
  const capsules = await getCapsules();
  capsules.push(capsule);
  await chrome.storage.local.set({ capsules });
}

async function deleteCapsule(id) {
  const capsules = await getCapsules();
  const updated = capsules.filter((c) => c.id !== id);
  await chrome.storage.local.set({ capsules: updated });
}
