const browserAPI = (typeof browser !== 'undefined' ? browser : chrome);

(() => {
  const DEBUG = true;
  
  function createPopup(text) {
    const popup = document.createElement('div');
    popup.className = 'stampy-popup';
    
    popup.innerHTML = `
      <div class="stampy-popup-header">
        <h3>Stampy Analysis</h3>
        <button class="stampy-close-btn">×</button>
      </div>
      <div class="stampy-response">
        <div class="stampy-loading">Analyzing...</div>
      </div>
      <div class="stampy-citations"></div>
    `;
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'citation-tooltip';
    document.body.appendChild(tooltip);
    
    // Add tooltip handlers
    popup.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('citation-ref')) {
        const citation = e.target.dataset.citation;
        tooltip.textContent = decodeURIComponent(citation);
        tooltip.classList.add('visible');
        
        const rect = e.target.getBoundingClientRect();
        tooltip.style.setProperty('--tooltip-top', `${rect.bottom + 5}px`);
      }
    });
    
    popup.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('citation-ref')) {
        tooltip.classList.remove('visible');
      }
    });
    
    popup.querySelector('.stampy-close-btn').addEventListener('click', () => {
      document.querySelectorAll('.stampy-popup').forEach(p => p.remove());
      tooltip.remove(); // Clean up tooltip when closing popup
    });
    
    return popup;
  }
  
  function formatContent(content, citations) {
    // Replace original references with display references
    let formattedContent = formatCitations(content);
    citations.forEach(c => {
      formattedContent = formattedContent.replace(
        new RegExp(`\\[${c.reference}\\]`, 'g'),
        `<span class="citation-ref" data-citation="${encodeURIComponent(c.text.split('###')[2] || c.text)}">[${c.displayRef}]</span>`
      );
    });
    
    return formattedContent
      .split('\n')
      .map(line => `<p>${line.trim() || '&nbsp;'}</p>`)
      .join('');
  }
  
  function getUsedCitations(content, citations) {
    const formattedContent = formatCitations(content);
    // Get citations in order of first appearance
    const usedRefs = [];
    const seen = new Set();
    [...formattedContent.matchAll(/\[(\d+)\]/g)].forEach(m => {
      const ref = m[1];
      if (!seen.has(ref)) {
        seen.add(ref);
        usedRefs.push(ref);
      }
    });
    
    const orderedCitations = citations
      .filter(c => usedRefs.includes(c.reference))
      // Sort by order of first appearance
      .sort((a, b) => usedRefs.indexOf(a.reference) - usedRefs.indexOf(b.reference))
      .map((c, idx) => ({
        ...c,
        displayRef: (idx + 1).toString()
      }));
    
    return orderedCitations;
  }
  
  function renderCitations(citations) {
    if (!citations.length) return '';
    return `
      <h4>Sources</h4>
      ${citations.map(c => `
        <div class="citation">
          <p>
            <strong>[${c.displayRef}]</strong>
            <a href="${c.url}" target="_blank">${c.title}</a>
            ${c.authors ? `<span class="citation-authors">by ${c.authors.join(', ')}</span>` : ''}
          </p>
        </div>
      `).join('')}
    `;
  }
  
  async function handleAnalysis(msg, popup) {
    const responseEl = popup.querySelector('.stampy-response');
    const citationsEl = popup.querySelector('.stampy-citations');
    
    let apiEndpoint = 'http://localhost:3001/chat';
    
    try {
      const result = await browserAPI.storage.sync.get({
        apiEndpoint: apiEndpoint
      });
      apiEndpoint = result.apiEndpoint;
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          query: msg.text, 
          settings: {}, 
          stream: true,
          sessionId: browserAPI.runtime.id
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }

      let content = '';
      let allCitations = [];

      for await (const data of iterateData(response)) {
        switch (data.state) {
          case 'streaming':
            content += data.content;
            if (content.trim()) {
              // Update citations as content streams in
              const usedCitations = getUsedCitations(content, allCitations);
              if (usedCitations.length) {
                responseEl.innerHTML = formatContent(content, usedCitations);
                citationsEl.innerHTML = renderCitations(usedCitations);
              }
            }
            break;
          case 'citations':
            allCitations = data.citations || [];
            break;
          case 'error':
            throw new Error(data.error);
        }
      }
    } catch (error) {
      console.error('Failed to get analysis:', error);
      responseEl.innerHTML = `Error: ${error.message}. Make sure the API server is running at ${apiEndpoint}`;
    }
  }
  
  // From useChat.ts - formats citations into standard form
  function formatCitations(text) {
    // transform all things that look like [1, 2, 3] into [1][2][3]
    let response = text.replace(
      /\[((?:\d+,\s*)*\d+)\]/g,
      (block) => block.split(',').map((x) => x.trim()).join('][')
    );
  
    // transform all things that look like [(1), (2), (3)] into [(1)][(2)][(3)]
    response = response.replace(
      /\[((?:\(\d+\),\s*)*\(\d+\))\]/g,
      (block) => block.split(',').map((x) => x.trim()).join('][')
    );
  
    // transform all things that look like [(3)] into [3]
    response = response.replace(/\[\((\d+)\)\]/g, (_match, x) => `[${x}]`);
  
    // transform all things that look like [ 12 ] into [12]
    response = response.replace(/\[\s*(\d+)\s*\]/g, (_match, x) => `[${x}]`);
    return response;
  }
  
  async function* iterateData(res) {
    const reader = res.body.getReader();
    let message = '';
  
    while (true) {
      const {done, value} = await reader.read();
      if (done) return;
  
      const chunk = new TextDecoder('utf-8').decode(value);
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: close')) {
          return;
        } else if (line.startsWith('data: ')) {
          message += line.slice('data: '.length);
        } else if (line !== '') {
          message += line;
        } else if (message !== '') {
          yield JSON.parse(message);
          message = '';
        }
      }
    }
  }
  
  // Listen for messages from background script
  browserAPI.runtime.onMessage.addListener(async (msg) => {
    if (msg.type === "ANALYZE_TEXT") {
      document.querySelectorAll('.stampy-popup').forEach(p => p.remove());
      const popup = createPopup(msg.text);
      document.body.appendChild(popup);
      await handleAnalysis(msg, popup);
    }
  });
})(); 