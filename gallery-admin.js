(function GalleryAdmin() {
  'use strict';
  const endpoint = (window.WL_CONFIG || {}).GALLERY_FUNCTION_URL;
  const unlockView = document.getElementById('unlock-view');
  const reviewView = document.getElementById('review-view');
  const unlockForm = document.getElementById('unlock-form');
  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  const unlockError = document.getElementById('unlock-error');
  const lockButton = document.getElementById('lock-admin');
  const refreshButton = document.getElementById('refresh-queue');
  const reviewGrid = document.getElementById('review-grid');
  const queueStatus = document.getElementById('queue-status');
  const template = document.getElementById('submission-template');
  const queueTabs = Array.from(document.querySelectorAll('[data-queue-status]'));
  let adminKey = sessionStorage.getItem('flamingos_gallery_admin') || '';
  let activeStatus = 'pending';

  function authHeaders() { return { Accept:'application/json', Authorization:`Bearer ${adminKey}` }; }
  function shortWallet(wallet) { return `${wallet.slice(0,8)}…${wallet.slice(-6)}`; }

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    let payload = {};
    try { payload = await response.json(); } catch { /* noop */ }
    if (!response.ok) throw new Error(payload.message || (response.status === 401 ? 'Wrong admin key.' : 'Request failed.'));
    return payload;
  }

  async function loadQueue() {
    if (!endpoint) throw new Error('Gallery endpoint is not configured.');
    queueStatus.textContent = 'LOADING SUBMISSIONS...';
    const payload = await api(`${endpoint}?mode=admin&status=${encodeURIComponent(activeStatus)}`, { headers:authHeaders() });
    const items = Array.isArray(payload.items) ? payload.items : [];
    const stats = payload.stats || {};
    document.getElementById('pending-stat').textContent = stats.pending ?? 0;
    document.getElementById('approved-stat').textContent = stats.approved ?? 0;
    document.getElementById('rejected-stat').textContent = stats.rejected ?? 0;
    document.getElementById('gtd-stat').textContent = stats.gtd ?? 0;
    queueStatus.textContent = '';
    reviewGrid.replaceChildren();
    if (!items.length) {
      reviewGrid.innerHTML = `<div class="empty-state">NO ${activeStatus.toUpperCase()} ARTWORK.<br />THIS LIST IS CLEAN.</div>`;
      return;
    }
    items.forEach(renderSubmission);
  }

  function renderSubmission(item) {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = item.id;
    const image = card.querySelector('img');
    image.src = item.image_url;
    image.alt = `${item.title} by ${item.creator_name}`;
    card.querySelector('.status-pill').textContent = String(item.status || activeStatus).toUpperCase();
    card.querySelector('h2').textContent = item.title;
    const artist = card.querySelector('.artist-link');
    artist.href = item.x_url;
    artist.textContent = `${item.creator_name} ON X ↗`;
    card.querySelector('.vote-total').textContent = `${Number(item.votes || 0)} COMMUNITY VOTE${Number(item.votes || 0) === 1 ? '' : 'S'}`;
    card.querySelector('time').textContent = new Date(item.created_at).toLocaleDateString();
    const walletButton = card.querySelector('.wallet-copy');
    walletButton.textContent = `WALLET: ${shortWallet(item.wallet_address)} · COPY`;
    walletButton.title = item.wallet_address;
    walletButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(item.wallet_address);
      walletButton.textContent = 'WALLET COPIED ✓';
      setTimeout(() => { walletButton.textContent = `WALLET: ${shortWallet(item.wallet_address)} · COPY`; }, 1300);
    });

    const approveButton = card.querySelector('.approve-btn');
    const rejectButton = card.querySelector('.reject-btn');
    const deleteButton = card.querySelector('.delete-btn');
    if (activeStatus === 'pending') {
      approveButton.addEventListener('click', () => decide(card, 'approved'));
      rejectButton.addEventListener('click', () => decide(card, 'rejected'));
    } else {
      card.querySelector('.gtd-choice').hidden = true;
      approveButton.hidden = true;
      rejectButton.hidden = true;
      deleteButton.hidden = false;
      deleteButton.addEventListener('click', () => deleteArtwork(card));
    }
    reviewGrid.appendChild(card);
  }

  async function decide(card, status) {
    const buttons = card.querySelectorAll('.decision-row button');
    buttons.forEach((button) => { button.disabled = true; });
    queueStatus.textContent = status === 'approved' ? 'PUBLISHING ARTWORK...' : 'REJECTING ARTWORK...';
    try {
      await api(endpoint, {
        method:'PATCH',
        headers:{ ...authHeaders(), 'Content-Type':'application/json' },
        body:JSON.stringify({ id:card.dataset.id, status, gtd_spot:status === 'approved' && card.querySelector('.gtd-choice input').checked })
      });
      await loadQueue();
    } catch (error) {
      queueStatus.textContent = error.message;
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  async function deleteArtwork(card) {
    if (!confirm('Delete this artwork permanently from the gallery and storage?')) return;
    const button = card.querySelector('.delete-btn');
    button.disabled = true;
    button.textContent = 'DELETING...';
    queueStatus.textContent = 'DELETING ARTWORK...';
    try {
      await api(endpoint, {
        method:'DELETE',
        headers:{ ...authHeaders(), 'Content-Type':'application/json' },
        body:JSON.stringify({ id:card.dataset.id })
      });
      await loadQueue();
    } catch (error) {
      queueStatus.textContent = error.message;
      button.disabled = false;
      button.textContent = 'DELETE ARTWORK';
    }
  }

  async function unlock(event) {
    event && event.preventDefault();
    if (event && usernameInput.value.trim().toLowerCase() !== 'admin') {
      unlockError.textContent = 'Wrong username or password.';
      return;
    }
    adminKey = event ? passwordInput.value : adminKey;
    unlockError.textContent = 'CHECKING ACCESS...';
    try {
      await loadQueue();
      sessionStorage.setItem('flamingos_gallery_admin', adminKey);
      unlockView.hidden = true;
      reviewView.hidden = false;
      lockButton.hidden = false;
      unlockError.textContent = '';
    } catch (error) {
      adminKey = '';
      sessionStorage.removeItem('flamingos_gallery_admin');
      unlockError.textContent = error.message === 'Wrong admin key.' ? 'Wrong username or password.' : error.message;
    }
  }

  unlockForm.addEventListener('submit', unlock);
  refreshButton.addEventListener('click', () => loadQueue().catch((error) => { queueStatus.textContent = error.message; }));
  queueTabs.forEach((tab) => tab.addEventListener('click', () => {
    activeStatus = tab.dataset.queueStatus;
    queueTabs.forEach((item) => item.classList.toggle('active', item === tab));
    loadQueue().catch((error) => { queueStatus.textContent = error.message; });
  }));
  lockButton.addEventListener('click', () => {
    sessionStorage.removeItem('flamingos_gallery_admin');
    adminKey = '';
    reviewView.hidden = true;
    unlockView.hidden = false;
    lockButton.hidden = true;
    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.focus();
  });
  if (adminKey) unlock();
})();
