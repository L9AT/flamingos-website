(function CommunityGallery() {
  'use strict';

  const CFG = window.WL_CONFIG || {};
  const endpoint = CFG.GALLERY_FUNCTION_URL;
  const form = document.getElementById('gallery-form');
  const fileInput = document.getElementById('art-file');
  const fileDrop = document.getElementById('file-drop');
  const fileTitle = document.getElementById('file-title');
  const fileMeta = document.getElementById('file-meta');
  const filePreview = document.getElementById('file-preview');
  const formStatus = document.getElementById('form-status');
  const submitButton = document.getElementById('submit-art-btn');
  const success = document.getElementById('submit-success');
  const submitAnother = document.getElementById('submit-another');
  const artGrid = document.getElementById('art-grid');
  const approvedCount = document.getElementById('approved-count');
  const basePreviewImage = document.getElementById('base-preview-image');
  const baseDownload = document.getElementById('base-download');
  const baseOptions = Array.from(document.querySelectorAll('.base-option'));
  const shareModal = document.getElementById('submission-share');
  const sharePreview = document.getElementById('submission-share-preview');
  const shareStatus = document.getElementById('submission-share-status');
  const shareOnXButton = document.getElementById('share-submission-x');
  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
  let previewUrl = '';
  let submittedFile = null;
  let submittedTitle = '';

  baseOptions.forEach((option) => {
    option.addEventListener('click', () => {
      const src = option.dataset.src;
      const name = option.dataset.name;
      basePreviewImage.src = src;
      basePreviewImage.alt = `${name} Flamingo base`;
      baseDownload.href = src;
      baseDownload.download = `flamingos-base-${name.toLowerCase()}.png`;
      baseDownload.textContent = `↓ DOWNLOAD ${name.toUpperCase()} BASE`;
      baseOptions.forEach((item) => {
        const selected = item === option;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    });
  });

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function isValidXUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function creatorNameFromXUrl(value) {
    try {
      const username = new URL(value).pathname.split('/').filter(Boolean)[0] || '';
      return username.replace(/^@/, '').slice(0, 40);
    } catch {
      return '';
    }
  }

  function validateFile(file) {
    if (!file) return 'Choose your artwork first.';
    if (!ALLOWED_TYPES.has(file.type)) return 'Use a PNG, JPG, or WEBP image.';
    if (file.size > MAX_FILE_SIZE) return 'The artwork must be smaller than 8MB.';
    return '';
  }

  function showFile(file) {
    const error = validateFile(file);
    if (error) {
      fileInput.value = '';
      formStatus.textContent = error;
      return;
    }
    formStatus.textContent = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    filePreview.src = previewUrl;
    filePreview.hidden = false;
    fileDrop.classList.add('has-file');
    fileTitle.textContent = file.name;
    fileMeta.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }

  fileInput.addEventListener('change', () => showFile(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((name) => fileDrop.addEventListener(name, (event) => {
    event.preventDefault();
    fileDrop.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((name) => fileDrop.addEventListener(name, (event) => {
    event.preventDefault();
    fileDrop.classList.remove('dragging');
  }));
  fileDrop.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    showFile(file);
  });

  async function loadApprovedArt() {
    if (!artGrid || !approvedCount) return;
    if (!endpoint) {
      artGrid.innerHTML = '<div class="gallery-state">GALLERY IS BEING PREPARED.</div>';
      return;
    }
    try {
      const response = await fetch(`${endpoint}?mode=approved`, { headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Could not load gallery.');
      const items = Array.isArray(payload.items) ? payload.items : [];
      approvedCount.textContent = `${items.length} ARTWORK${items.length === 1 ? '' : 'S'}`;
      if (!items.length) {
        artGrid.innerHTML = '<div class="gallery-state">THE FIRST SELECTED ARTWORK COULD BE YOURS.</div>';
        return;
      }
      artGrid.innerHTML = items.map((item) => `
        <article class="art-card">
          ${item.gtd_spot ? '<span class="gtd-badge">★ GTD SPOT</span>' : ''}
          <div class="art-image"><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)} by ${escapeHtml(item.creator_name)}" loading="lazy" /></div>
          <div class="art-meta">
            <h3>${escapeHtml(item.title)}</h3>
            <a href="${escapeHtml(item.x_url)}" target="_blank" rel="noopener noreferrer">BY ${escapeHtml(item.creator_name)} ↗</a>
          </div>
        </article>
      `).join('');
    } catch (error) {
      const rawMessage = String(error.message || '');
      const message = /not found|failed to fetch/i.test(rawMessage)
        ? 'THE FIRST SELECTED ARTWORK COULD BE YOURS.'
        : (rawMessage || 'Could not load the gallery.');
      artGrid.innerHTML = `<div class="gallery-state">${escapeHtml(message)}</div>`;
      approvedCount.textContent = '— ARTWORKS';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formStatus.classList.remove('ok');
    formStatus.textContent = '';

    const file = fileInput.files[0];
    const fileError = validateFile(file);
    const title = document.getElementById('art-title').value.trim();
    const xUrl = document.getElementById('creator-x').value.trim();
    const creatorName = creatorNameFromXUrl(xUrl);
    const wallet = document.getElementById('creator-wallet').value.trim();
    const rightsAccepted = document.getElementById('art-rights').checked;

    if (fileError) return void (formStatus.textContent = fileError);
    if (title.length < 2) return void (formStatus.textContent = 'Add a title for your artwork.');
    if (!isValidXUrl(xUrl)) return void (formStatus.textContent = 'Add a valid X / Twitter profile link.');
    if (creatorName.length < 2) return void (formStatus.textContent = 'Your X link must include a username.');
    if (!EVM_RE.test(wallet)) return void (formStatus.textContent = 'Add a valid EVM wallet address.');
    if (!rightsAccepted) return void (formStatus.textContent = 'Confirm that this is your artwork.');
    if (!endpoint) return void (formStatus.textContent = 'Gallery submissions are not configured yet.');

    submitButton.disabled = true;
    submitButton.textContent = 'UPLOADING...';

    const body = new FormData(form);
    body.set('title', title);
    body.set('creator_name', creatorName);
    body.set('x_url', xUrl);
    body.set('wallet_address', wallet);

    try {
      const response = await fetch(endpoint, { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Submission failed. Please try again.');
      submittedFile = file;
      submittedTitle = title;
      form.hidden = true;
      success.hidden = false;
      openShareModal();
    } catch (error) {
      formStatus.textContent = error.message || 'Submission failed. Please try again.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'SUBMIT FOR REVIEW ↗';
    }
  });

  function openShareModal() {
    sharePreview.src = previewUrl;
    shareStatus.textContent = 'Your image will be copied for X.';
    shareModal.hidden = false;
    document.body.classList.add('submission-share-open');
    setTimeout(() => shareOnXButton.focus(), 30);
  }

  function closeShareModal() {
    shareModal.hidden = true;
    document.body.classList.remove('submission-share-open');
  }

  async function imageFileToPngBlob(file) {
    if (file.type === 'image/png') return file;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare image.')), 'image/png'));
  }

  async function shareSubmissionOnX() {
    if (!submittedFile) return;
    const siteUrl = String(CFG.SITE_URL || location.origin).replace(/\/$/, '');
    const caption = [
      'Just submitted my art to the @Flamingos_ETH Community Gallery 🦩',
      '',
      'Trying to make the flock laugh and win a GTD spot.',
      '',
      `Create yours: ${siteUrl}/gallery`,
      '',
      '#Flamingos #RobinhoodChain',
      '',
      '[PS: DON\'T FORGET TO ATTACH YOUR ART TO THIS TWEET!]'
    ].join('\n');
    const composer = window.open('about:blank', '_blank');
    shareOnXButton.disabled = true;
    shareOnXButton.textContent = 'PREPARING IMAGE...';
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('Clipboard unavailable');
      const png = await imageFileToPngBlob(submittedFile);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      shareStatus.textContent = 'Image copied — paste it into X with Ctrl + V.';
    } catch {
      shareStatus.textContent = 'Copy is unavailable. Download or attach your artwork manually in X.';
    } finally {
      const url = `https://x.com/intent/post?text=${encodeURIComponent(caption)}`;
      if (composer) composer.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
      shareOnXButton.disabled = false;
      shareOnXButton.textContent = '𝕏  SHARE ON X';
    }
  }

  document.querySelectorAll('[data-close-submission-share]').forEach((button) => button.addEventListener('click', closeShareModal));
  shareOnXButton.addEventListener('click', shareSubmissionOnX);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !shareModal.hidden) closeShareModal();
  });

  submitAnother.addEventListener('click', () => {
    closeShareModal();
    submittedFile = null;
    submittedTitle = '';
    form.reset();
    form.hidden = false;
    success.hidden = true;
    formStatus.textContent = '';
    filePreview.hidden = true;
    filePreview.removeAttribute('src');
    fileDrop.classList.remove('has-file');
    fileTitle.textContent = 'CHOOSE YOUR ART';
    fileMeta.textContent = 'or drop it here';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  });

  loadApprovedArt();
})();
