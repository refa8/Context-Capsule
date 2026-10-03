//message handling
importScripts("shared/storage.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_CAPSULES") {
    getCapsules()
      .then((capsules) => {
        sendResponse({
          success: true,
          capsules: capsules,
        });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true;
  }

  if (message.type === "SAVE_CAPSULE") {
    saveCapsule(message.capsule)
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message,
        }),
      );

    return true;
  }

  if (message.type === "DELETE_CAPSULE") {
    deleteCapsule(message.id)
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message,
        }),
      );

    return true;
  }
});
