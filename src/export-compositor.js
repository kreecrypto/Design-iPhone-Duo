(() => {
  const OUTER = { width: 360, height: 780, radius: 42, inset: 12 };
  const INNER = { width: 800, height: 600, radius: 34, inset: 14 };
  const PAD = 64;
  const GAP = 64;
  const PREFERENCE_KEY = 'design-iphone-duo.preferences.v1';

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawImageWithFit(ctx, image, x, y, width, height, mode) {
    if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
    const scale = mode === 'fit'
      ? Math.min(width / image.naturalWidth, height / image.naturalHeight)
      : Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
    return true;
  }

  function drawOuter(ctx, documentRef, x, y, fitMode) {
    const screenX = x + OUTER.inset;
    const screenY = y + OUTER.inset;
    const screenW = OUTER.width - OUTER.inset * 2;
    const screenH = OUTER.height - OUTER.inset * 2;
    ctx.fillStyle = '#17191d';
    roundedRect(ctx, x, y, OUTER.width, OUTER.height, OUTER.radius);
    ctx.fill();
    ctx.save();
    roundedRect(ctx, screenX, screenY, screenW, screenH, OUTER.radius - OUTER.inset);
    ctx.clip();
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(screenX, screenY, screenW, screenH);
    const image = documentRef.querySelector('#outer-screen img');
    drawImageWithFit(ctx, image, screenX, screenY, screenW, screenH, fitMode);
    ctx.restore();
    ctx.fillStyle = '#111318';
    roundedRect(ctx, x + OUTER.width / 2 - 52, y + 28, 104, 28, 14);
    ctx.fill();
  }

  function drawInner(ctx, documentRef, x, y, fitMode, creaseEnabled, appIconsEnabled) {
    const screenX = x + INNER.inset;
    const screenY = y + INNER.inset;
    const screenW = INNER.width - INNER.inset * 2;
    const screenH = INNER.height - INNER.inset * 2;
    ctx.fillStyle = '#17191d';
    roundedRect(ctx, x, y, INNER.width, INNER.height, INNER.radius);
    ctx.fill();
    ctx.save();
    roundedRect(ctx, screenX, screenY, screenW, screenH, INNER.radius - INNER.inset);
    ctx.clip();
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(screenX, screenY, screenW, screenH);
    const image = documentRef.querySelector('#inner-screen img');
    drawImageWithFit(ctx, image, screenX, screenY, screenW, screenH, fitMode);

    const hinge = ctx.createLinearGradient(x + INNER.width / 2 - 10, 0, x + INNER.width / 2 + 10, 0);
    hinge.addColorStop(0, 'rgba(17,19,24,.05)');
    hinge.addColorStop(.48, 'rgba(255,255,255,.16)');
    hinge.addColorStop(1, 'rgba(17,19,24,.12)');
    ctx.fillStyle = hinge;
    ctx.fillRect(x + INNER.width / 2 - 8, screenY, 16, screenH);

    if (creaseEnabled) {
      const crease = ctx.createLinearGradient(x + INNER.width / 2 - 18, 0, x + INNER.width / 2 + 18, 0);
      crease.addColorStop(0, 'rgba(17,19,24,.12)');
      crease.addColorStop(.45, 'rgba(255,255,255,.28)');
      crease.addColorStop(.55, 'rgba(17,19,24,.20)');
      crease.addColorStop(1, 'rgba(255,255,255,.10)');
      ctx.fillStyle = crease;
      ctx.fillRect(x + INNER.width / 2 - 14, screenY, 28, screenH);
    }

    if (appIconsEnabled) {
      const dockW = 248;
      const dockH = 72;
      const dockX = x + INNER.width / 2 - dockW / 2;
      const dockY = y + INNER.height - INNER.inset - 92;
      ctx.fillStyle = 'rgba(255,255,255,.78)';
      roundedRect(ctx, dockX, dockY, dockW, dockH, 24);
      ctx.fill();
      const iconColors = ['#dfe5ec', '#edf1f5', '#555d68', '#c8d0da', '#8995a4'];
      for (let i = 0; i < 5; i += 1) {
        const iconX = dockX + 24 + i * 44;
        const iconY = dockY + 16;
        ctx.fillStyle = iconColors[i];
        roundedRect(ctx, iconX, iconY, 40, 40, i === 1 ? 20 : 11);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function render(options = {}) {
    const documentRef = options.document || document;
    const workspace = documentRef.querySelector('#preview-workspace');
    if (!workspace) throw new Error('Preview workspace not found.');
    const scope = options.scope || workspace.dataset.viewMode || 'both';
    if (!['both', 'outer', 'inner'].includes(scope)) throw new Error(`Unsupported export scope: ${scope}`);
    const fitMode = documentRef.querySelector('#fit-mode')?.getAttribute('aria-pressed') === 'true' ? 'fit' : 'fill';
    const creaseEnabled = workspace.dataset.crease === 'on';
    const appIconsEnabled = workspace.dataset.appIcons === 'on';
    const includeOuter = scope === 'both' || scope === 'outer';
    const includeInner = scope === 'both' || scope === 'inner';
    const contentWidth = (includeOuter ? OUTER.width : 0) + (includeOuter && includeInner ? GAP : 0) + (includeInner ? INNER.width : 0);
    const contentHeight = Math.max(includeOuter ? OUTER.height : 0, includeInner ? INNER.height : 0);
    const canvas = documentRef.createElement('canvas');
    canvas.width = contentWidth + PAD * 2;
    canvas.height = contentHeight + PAD * 2;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.fillStyle = options.background || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const placements = {};
    let cursorX = PAD;
    if (includeOuter) {
      const outerY = PAD + (contentHeight - OUTER.height) / 2;
      drawOuter(ctx, documentRef, cursorX, outerY, fitMode);
      placements.outer = { x: cursorX, y: outerY, width: OUTER.width, height: OUTER.height };
      cursorX += OUTER.width + (includeInner ? GAP : 0);
    }
    if (includeInner) {
      const innerY = PAD + (contentHeight - INNER.height) / 2;
      drawInner(ctx, documentRef, cursorX, innerY, fitMode, creaseEnabled, appIconsEnabled);
      placements.inner = { x: cursorX, y: innerY, width: INNER.width, height: INNER.height };
    }

    return {
      canvas,
      metadata: {
        scope,
        fitMode,
        crease: creaseEnabled,
        appIcons: appIconsEnabled,
        background: options.background || '#ffffff',
        placements
      }
    };
  }

  function renderBoth(options = {}) {
    return render({ ...options, scope: 'both' });
  }

  function ensureSaveFallbackGuidance(documentRef = document) {
    const status = documentRef.querySelector('#app-status');
    if (!status) return null;
    let guidance = documentRef.querySelector('#save-fallback-guidance');
    if (!guidance) {
      guidance = documentRef.createElement('p');
      guidance.id = 'save-fallback-guidance';
      guidance.className = 'privacy-note';
      guidance.setAttribute('role', 'note');
      guidance.hidden = true;
      guidance.textContent = 'If the PNG does not save in this in-app browser, use its menu to open this page in Safari or Chrome, then choose Export PNG again. Your screenshots remain local to this page.';
      status.insertAdjacentElement('afterend', guidance);
    }
    return guidance;
  }

  function showSaveFallback(documentRef = document) {
    const guidance = ensureSaveFallbackGuidance(documentRef);
    if (guidance) guidance.hidden = false;
    return guidance;
  }

  function ensureExportDialog(documentRef = document) {
    let dialog = documentRef.querySelector('#export-dialog');
    if (dialog) return dialog;
    dialog = documentRef.createElement('dialog');
    dialog.id = 'export-dialog';
    dialog.setAttribute('aria-labelledby', 'export-dialog-title');
    dialog.setAttribute('aria-describedby', 'export-dialog-description');
    dialog.style.width = 'min(420px, calc(100% - 32px))';
    dialog.style.maxWidth = '100%';
    dialog.style.border = '1px solid #dfe3e8';
    dialog.style.borderRadius = '16px';
    dialog.style.padding = '20px';
    dialog.style.boxShadow = '0 24px 64px rgba(17,19,24,.24)';
    dialog.innerHTML = '<h2 id="export-dialog-title" style="margin:0 0 8px;font-size:1.2rem">Exporting PNG</h2><p id="export-dialog-description" style="margin:0 0 16px;color:#505762">Your PNG is created locally in this browser. Close this dialog after the download starts.</p><button type="button" id="export-dialog-close" style="min-height:44px;padding:0 16px;border:1px solid #c9ced6;border-radius:10px;background:#fff;font:inherit;font-weight:650">Close</button>';
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (focusable.length === 1 || (!event.shiftKey && documentRef.activeElement === last) || (event.shiftKey && documentRef.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });
    dialog.addEventListener('close', () => {
      const returnFocus = dialog.__returnFocus;
      dialog.__returnFocus = null;
      if (!returnFocus || typeof returnFocus.focus !== 'function') return;
      const restore = () => {
        if (!returnFocus.disabled && returnFocus.isConnected) returnFocus.focus();
        else setTimeout(() => { if (!returnFocus.disabled && returnFocus.isConnected) returnFocus.focus(); }, 100);
      };
      requestAnimationFrame(restore);
    });
    dialog.querySelector('#export-dialog-close')?.addEventListener('click', () => dialog.close());
    documentRef.body.appendChild(dialog);
    return dialog;
  }

  function installExportDialog(documentRef = document) {
    const exportButton = documentRef.querySelector('#export-button');
    if (!exportButton || exportButton.dataset.exportDialogInstalled === 'true') return;
    exportButton.dataset.exportDialogInstalled = 'true';
    const dialog = ensureExportDialog(documentRef);
    exportButton.addEventListener('click', () => {
      if (!dialog || typeof dialog.showModal !== 'function' || dialog.open) return;
      dialog.__returnFocus = exportButton;
      dialog.showModal();
      dialog.querySelector('#export-dialog-close')?.focus();
    }, { capture: true });
  }

  function installSaveFallbackObserver(documentRef = document) {
    const status = documentRef.querySelector('#app-status');
    if (!status || status.dataset.saveFallbackObserved === 'true') return;
    status.dataset.saveFallbackObserved = 'true';
    ensureSaveFallbackGuidance(documentRef);
    const maybeShowGuidance = () => {
      const message = status.textContent || '';
      if (/could not be created|unavailable because the compositor did not load/i.test(message)) showSaveFallback(documentRef);
    };
    new MutationObserver(maybeShowGuidance).observe(status, { childList: true, characterData: true, subtree: true });
    maybeShowGuidance();
  }

  function installViewModes(documentRef = document) {
    const workspace = documentRef.querySelector('#preview-workspace');
    const outerPanel = documentRef.querySelector('#outer-panel');
    const innerPanel = documentRef.querySelector('#inner-panel');
    const status = documentRef.querySelector('#app-status');
    const buttons = { both: documentRef.querySelector('#view-both'), outer: documentRef.querySelector('#view-outer'), inner: documentRef.querySelector('#view-inner') };
    if (!workspace || !outerPanel || !innerPanel || Object.values(buttons).some((button) => !button)) return;
    const setMode = (mode) => {
      workspace.dataset.viewMode = mode;
      outerPanel.hidden = mode === 'inner';
      innerPanel.hidden = mode === 'outer';
      for (const [name, button] of Object.entries(buttons)) button.setAttribute('aria-pressed', String(name === mode));
      if (status) status.textContent = mode === 'both' ? 'Both view active. Outer and Inner previews remain visible with their current image state.' : `${mode === 'outer' ? 'Outer' : 'Inner'} view active. Hidden preview state remains loaded locally.`;
    };
    for (const [mode, button] of Object.entries(buttons)) {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
      if (button.dataset.viewModeInstalled === 'true') continue;
      button.dataset.viewModeInstalled = 'true';
      button.addEventListener('click', () => setMode(mode));
    }
  }

  function readPreferences(storage) {
    try {
      const raw = storage.getItem(PREFERENCE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return null;
      return {
        version: 1,
        viewMode: ['both', 'outer', 'inner'].includes(parsed.viewMode) ? parsed.viewMode : 'both',
        fitMode: ['fill', 'fit'].includes(parsed.fitMode) ? parsed.fitMode : 'fill',
        crease: parsed.crease === true,
        appIcons: parsed.appIcons === true
      };
    } catch (_) {
      return null;
    }
  }

  function collectPreferences(documentRef = document) {
    const workspace = documentRef.querySelector('#preview-workspace');
    return {
      version: 1,
      viewMode: ['both', 'outer', 'inner'].includes(workspace?.dataset.viewMode) ? workspace.dataset.viewMode : 'both',
      fitMode: documentRef.querySelector('#fit-mode')?.getAttribute('aria-pressed') === 'true' ? 'fit' : 'fill',
      crease: documentRef.querySelector('#crease-toggle')?.getAttribute('aria-checked') === 'true',
      appIcons: documentRef.querySelector('#app-icons-toggle')?.getAttribute('aria-checked') === 'true'
    };
  }

  function writePreferences(documentRef, storage) {
    try {
      storage.setItem(PREFERENCE_KEY, JSON.stringify(collectPreferences(documentRef)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function restorePreferences(documentRef, storage) {
    const prefs = readPreferences(storage);
    if (!prefs) return false;
    documentRef.querySelector(`#view-${prefs.viewMode}`)?.click();
    documentRef.querySelector(prefs.fitMode === 'fit' ? '#fit-mode' : '#fill-mode')?.click();
    const crease = documentRef.querySelector('#crease-toggle');
    if (crease && (crease.getAttribute('aria-checked') === 'true') !== prefs.crease) crease.click();
    const appIcons = documentRef.querySelector('#app-icons-toggle');
    if (appIcons && (appIcons.getAttribute('aria-checked') === 'true') !== prefs.appIcons) appIcons.click();
    return true;
  }

  function getPreferenceStorage() {
    try {
      return window.localStorage;
    } catch (_) {
      return null;
    }
  }

  function installPreferencePersistence(documentRef = document) {
    const storage = getPreferenceStorage();
    if (!storage || documentRef.documentElement.dataset.preferencePersistenceInstalled === 'true') return;
    documentRef.documentElement.dataset.preferencePersistenceInstalled = 'true';
    restorePreferences(documentRef, storage);
    const preferenceControls = new Set(['view-both', 'view-outer', 'view-inner', 'fill-mode', 'fit-mode', 'crease-toggle', 'app-icons-toggle']);
    documentRef.addEventListener('click', (event) => {
      if (preferenceControls.has(event.target?.id)) queueMicrotask(() => writePreferences(documentRef, storage));
    });
  }

  function installWhenReady() {
    const install = () => {
      installSaveFallbackObserver(document);
      installExportDialog(document);
      installViewModes(document);
      installPreferencePersistence(document);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }

  installWhenReady();
  window.DuoExportCompositor = Object.freeze({ render, renderBoth, showSaveFallback, collectPreferences });
})();