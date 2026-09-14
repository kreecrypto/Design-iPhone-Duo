(() => {
  const OUTER = { width: 360, height: 780, radius: 42, inset: 12 };
  const INNER = { width: 800, height: 600, radius: 34, inset: 14 };
  const PAD = 64;
  const GAP = 64;

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

  window.DuoExportCompositor = Object.freeze({ render, renderBoth });
})();
