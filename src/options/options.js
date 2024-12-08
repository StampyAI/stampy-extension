const browserAPI = (typeof browser !== 'undefined' ? browser : chrome);

const DEFAULT_ENDPOINT = 'http://127.0.0.1:3001/chat';

// Saves options to browser.storage
function saveOptions(e) {
  e.preventDefault();
  browserAPI.storage.sync.set({
    apiEndpoint: document.querySelector("#apiEndpoint").value || DEFAULT_ENDPOINT
  });
}

// Restores select box and checkbox state using the preferences
// stored in browser.storage.
async function restoreOptions() {
  const result = await browserAPI.storage.sync.get({
    apiEndpoint: DEFAULT_ENDPOINT
  });
  document.querySelector("#apiEndpoint").value = result.apiEndpoint;
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions); 