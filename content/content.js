chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "EXTRACT") {
    try {
      const adapter = getAdapter();

      if (!adapter) {
        sendResponse({
          success: false,
          error: "Unsupported website",
        });
        return;
      }

      const messages = await adapter.getMessages();

      if (!messages.length) {
        sendResponse({
          success: false,
          error: "No conversation found",
        });
        return;
      }

      const content = messages.map((m) => `${m.role}: ${m.text}`).join("\n\n");

      sendResponse({
        success: true,
        content,
        source: adapter.name,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }

    return;
  }

  if (message.type === "INJECT") {
    try {
      const adapter = getAdapter();

      if (!adapter) {
        sendResponse({
          success: false,
          error: "Unsupported website",
        });
        return;
      }

      adapter.inject(message.content);

      sendResponse({
        success: true,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
      });
    }

    return;
  }
});
