document.addEventListener('DOMContentLoaded', async () => {
  const appUrlInput = document.getElementById('appUrl');
  const authTokenInput = document.getElementById('authToken');
  const ingestBtn = document.getElementById('ingestBtn');
  const statusBox = document.getElementById('statusBox');

  // Load saved settings from Chrome Storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['oe_app_url', 'oe_auth_token'], (items) => {
      if (items.oe_app_url) appUrlInput.value = items.oe_app_url;
      else appUrlInput.value = 'http://localhost:3000';
      if (items.oe_auth_token) authTokenInput.value = items.oe_auth_token;
    });
  } else {
    appUrlInput.value = 'http://localhost:3000';
  }

  ingestBtn.addEventListener('click', async () => {
    const rawAppUrl = (appUrlInput.value || 'http://localhost:3000').trim().replace(/\/+$/, '');
    const token = (authTokenInput.value || '').trim();

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ oe_app_url: rawAppUrl, oe_auth_token: token });
    }

    statusBox.className = 'status';
    statusBox.style.display = 'none';
    ingestBtn.disabled = true;
    ingestBtn.innerText = 'Extracting Profile...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        throw new Error('No active browser tab detected.');
      }

      // Execute content script in active tab
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractLinkedInProfile,
      });

      const extracted = results?.[0]?.result;
      if (!extracted) {
        throw new Error('Could not extract details from this tab. Ensure you are on a LinkedIn profile page.');
      }

      ingestBtn.innerText = 'Sending to Pipeline...';

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['x-api-key'] = token;

      const endpoint = `${rawAppUrl}/api/ingest/linkedin`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(extracted),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        statusBox.className = 'status success';
        statusBox.innerText = `✅ Ingested: ${extracted.name} @ ${extracted.company}`;
      } else {
        statusBox.className = 'status error';
        statusBox.innerText = `❌ ${data.error || 'Server error occurred'}`;
      }
    } catch (err) {
      statusBox.className = 'status error';
      statusBox.innerText = `❌ ${err.message}`;
    } finally {
      ingestBtn.disabled = false;
      ingestBtn.innerText = '⚡ Ingest Recruiter Profile';
    }
  });
});

function extractLinkedInProfile() {
  const nameEl = document.querySelector('h1.text-heading-xlarge, h1.inline, .pv-top-card--list h1, .v-align-middle.break-words');
  const titleEl = document.querySelector('.text-body-medium.break-words, .pv-top-card--list-bullet .text-body-medium, [data-generated-suggestion-target]');
  const companyEl = document.querySelector('div[aria-label="Current company"], .pv-text-details__right-panel button span, .experience-item h4');

  const name = nameEl ? nameEl.innerText.trim() : 'Recruiter';
  const title = titleEl ? titleEl.innerText.trim() : 'Talent Acquisition';
  let company = companyEl ? companyEl.innerText.trim() : '';

  if (!company && title.includes(' at ')) {
    company = title.split(' at ')[1].trim();
  } else if (!company && title.includes(' @ ')) {
    company = title.split(' @ ')[1].trim();
  }

  if (!company) {
    company = 'Target Tech Company';
  }

  return {
    name,
    title,
    company,
    linkedinUrl: window.location.href,
  };
}
