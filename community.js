(function CommunityArt() {
  'use strict';
  const endpoint = (window.WL_CONFIG || {}).GALLERY_FUNCTION_URL;
  const grid = document.getElementById('art-grid');
  const count = document.getElementById('approved-count');
  const voterKey = 'flamingos-community-voter';
  const votedKey = 'flamingos-community-voted';

  function getVoterToken() {
    let token = localStorage.getItem(voterKey);
    if (!token) {
      token = self.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(voterKey, token);
    }
    return token;
  }

  function getVotedIds() {
    try { return new Set(JSON.parse(localStorage.getItem(votedKey) || '[]')); }
    catch { return new Set(); }
  }

  function rememberVote(id) {
    const ids = getVotedIds();
    ids.add(id);
    localStorage.setItem(votedKey, JSON.stringify([...ids]));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char]);
  }

  async function load() {
    if (!endpoint) return void (grid.innerHTML = '<div class="gallery-state">THE GALLERY IS BEING PREPARED.</div>');
    try {
      const response = await fetch(`${endpoint}?mode=approved`, { headers:{ Accept:'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Could not load gallery.');
      const items = Array.isArray(payload.items) ? payload.items : [];
      count.textContent = `${items.length} ARTWORK${items.length === 1 ? '' : 'S'}`;
      if (!items.length) return void (grid.innerHTML = '<div class="gallery-state">THE FIRST SELECTED ARTWORK COULD BE YOURS.</div>');
      const votedIds = getVotedIds();
      grid.innerHTML = items.map((item) => `<article class="art-card">
        ${item.gtd_spot ? '<span class="gtd-badge">★ GTD SPOT</span>' : ''}
        <div class="art-image"><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)} by ${escapeHtml(item.creator_name)}" loading="lazy" /></div>
        <div class="art-meta"><h3>${escapeHtml(item.title)}</h3><a href="${escapeHtml(item.x_url)}" target="_blank" rel="noopener noreferrer">BY ${escapeHtml(item.creator_name)} ↗</a></div>
        <div class="art-actions"><button class="vote-button${votedIds.has(item.id) ? ' is-voted' : ''}" type="button" data-vote-id="${escapeHtml(item.id)}" aria-pressed="${votedIds.has(item.id)}" ${votedIds.has(item.id) ? 'disabled' : ''}><span>${votedIds.has(item.id) ? 'VOTED FUNNIEST' : 'VOTE FUNNIEST'}</span><strong>${Number(item.votes || 0)}</strong></button></div>
      </article>`).join('');
      grid.insertAdjacentHTML('afterend', '<p class="vote-note" id="vote-note">ONE VOTE PER ARTWORK, PER DEVICE · COMMUNITY VOTES HELP INFORM THE FINAL GTD PICK.</p>');
    } catch (error) {
      const message = /not found|failed to fetch/i.test(String(error.message || '')) ? 'THE FIRST SELECTED ARTWORK COULD BE YOURS.' : (error.message || 'Could not load gallery.');
      grid.innerHTML = `<div class="gallery-state">${escapeHtml(message)}</div>`;
    }
  }

  grid.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-vote-id]');
    if (!button || button.disabled || !endpoint) return;
    const id = button.dataset.voteId;
    const label = button.querySelector('span');
    const total = button.querySelector('strong');
    button.disabled = true;
    label.textContent = 'VOTING...';
    try {
      const response = await fetch(`${endpoint}?mode=vote`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Accept:'application/json' },
        body: JSON.stringify({ id, voter_token:getVoterToken() }),
      });
      const payload = await response.json();
      if (!response.ok && response.status !== 409) throw new Error(payload.message || 'Vote failed.');
      rememberVote(id);
      button.classList.add('is-voted');
      button.setAttribute('aria-pressed', 'true');
      label.textContent = 'VOTED FUNNIEST';
      if (Number.isFinite(Number(payload.votes))) total.textContent = String(payload.votes);
    } catch (error) {
      button.disabled = false;
      label.textContent = 'TRY AGAIN';
      window.setTimeout(() => { if (!button.classList.contains('is-voted')) label.textContent = 'VOTE FUNNIEST'; }, 1600);
    }
  });
  load();
})();
