/**
 * 1-Click LinkedIn Recruiter Ingestion Bookmarklet
 * Drag this code to your browser bookmarks bar.
 * When browsing any LinkedIn profile, click the bookmark to ingest the prospect into Outreach Engine.
 */
javascript:(function(){
  try {
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
      company = prompt('Enter Company Name for ' + name + ':', 'Technology Corp') || 'Company';
    }

    const payload = {
      name: name,
      title: title,
      company: company,
      linkedinUrl: window.location.href,
    };

    // Replace with your active Outreach Engine URL or localhost:3000
    const endpoint = (window.location.origin.includes('localhost') ? window.location.origin : 'http://localhost:3000') + '/api/ingest/linkedin';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        alert('✅ Ingested ' + name + ' (' + company + ') into Outreach Engine!');
      } else {
        alert('❌ Ingestion Error: ' + (data.error || 'Check server connection'));
      }
    })
    .catch(err => {
      alert('❌ Ingestion network error: ' + err.message);
    });
  } catch(e) {
    alert('Error extracting LinkedIn details: ' + e.message);
  }
})();
