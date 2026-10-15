// gallery.js — 画廊页：展示、勾选、批量下载
(() => {
  let allImages = [];
  const selected = new Set(); // 已勾选的下标
  const excluded = new Set(); // 加载后确认尺寸过小被忽略的下标

  const grid = document.getElementById('grid');
  const totalCountEl = document.getElementById('totalCount');
  const selectedCountEl = document.getElementById('selectedCount');
  const progressEl = document.getElementById('progress');
  const progressBarEl = document.getElementById('progressBar');
  const progressTextEl = document.getElementById('progressText');
  const resultEl = document.getElementById('result');
  const downloadBtn = document.getElementById('download');

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindToolbar();
    loadImages();
    // 监听后台下载进度与结果
    chrome.runtime.onMessage.addListener(onMessage);
  }

  async function loadImages() {
    const data = await chrome.storage.local.get('images');
    allImages = data.images || [];
    render();
  }

  function render() {
    grid.innerHTML = '';
    if (allImages.length === 0) {
      grid.innerHTML = '<p class="empty">暂无图片，请回到商品详情页点击「获取图片」。</p>';
      updateCount();
      return;
    }
    const frag = document.createDocumentFragment();
    allImages.forEach((img, idx) => {
      frag.appendChild(createItem(img, idx));
    });
    grid.appendChild(frag);
    updateCount();
  }

  function createItem(img, idx) {
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.index = String(idx);

    // 缩略图
    const wrap = document.createElement('div');
    wrap.className = 'thumb';
    const im = document.createElement('img');
    im.loading = 'lazy';
    im.referrerPolicy = 'no-referrer';
    im.alt = '图片 ' + (idx + 1);
    im.src = img.url;
    im.addEventListener('load', () => onImgLoad(idx, im, item));
    im.addEventListener('error', () => item.classList.add('broken'));
    wrap.appendChild(im);

    // 尺寸信息
    const info = document.createElement('div');
    info.className = 'info';
    const dim = document.createElement('span');
    dim.className = 'dim';
    dim.textContent = img.width && img.height ? `${img.width}×${img.height}` : '…';
    info.appendChild(dim);

    // 复选框
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'check';
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(idx);
      else selected.delete(idx);
      updateCount();
    });

    item.appendChild(wrap);
    item.appendChild(info);
    item.appendChild(cb);

    // 点击缩略图切换勾选
    wrap.addEventListener('click', () => {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });

    return item;
  }

  function onImgLoad(idx, im, item) {
    const w = im.naturalWidth;
    const h = im.naturalHeight;
    if (w > 0 && h > 0) {
      const dimEl = item.querySelector('.dim');
      if (dimEl) dimEl.textContent = `${w}×${h}`;

      // 动态过滤：加载后确认尺寸过小的图片
      if (w < 100 || h < 100) {
        excluded.add(idx);
        selected.delete(idx);
        const cb = item.querySelector('.check');
        if (cb) {
          cb.checked = false;
          cb.disabled = true;
        }
        item.classList.add('small');
        updateCount();
      }
    }
  }

  function bindToolbar() {
    document.getElementById('selectAll').addEventListener('click', () => {
      allImages.forEach((_, idx) => {
        if (excluded.has(idx)) return;
        selected.add(idx);
      });
      syncCheckboxes();
      updateCount();
    });

    document.getElementById('invert').addEventListener('click', () => {
      allImages.forEach((_, idx) => {
        if (excluded.has(idx)) return;
        if (selected.has(idx)) selected.delete(idx);
        else selected.add(idx);
      });
      syncCheckboxes();
      updateCount();
    });

    downloadBtn.addEventListener('click', onDownload);
  }

  function syncCheckboxes() {
    grid.querySelectorAll('.item').forEach((item) => {
      const idx = Number(item.dataset.index);
      const cb = item.querySelector('.check');
      if (cb) cb.checked = selected.has(idx);
    });
  }

  function updateCount() {
    selectedCountEl.textContent = String(selected.size);
    totalCountEl.textContent = String(allImages.length - excluded.size);
  }

  function onDownload() {
    if (selected.size === 0) {
      resultEl.textContent = '请先勾选要下载的图片。';
      resultEl.classList.remove('hidden');
      return;
    }
    const images = [];
    allImages.forEach((img, idx) => {
      if (selected.has(idx) && !excluded.has(idx)) images.push(img);
    });

    downloadBtn.disabled = true;
    showProgress();
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_IMAGES', images }).catch(() => {});
  }

  function showProgress() {
    progressEl.classList.remove('hidden');
    progressBarEl.style.width = '0%';
    progressTextEl.textContent = '';
  }

  function onMessage(msg) {
    if (msg.type === 'DOWNLOAD_PROGRESS') {
      const pct = Math.round((msg.current / msg.total) * 100);
      progressBarEl.style.width = pct + '%';
      progressTextEl.textContent =
        '正在下载 ' + msg.current + '/' + msg.total + (msg.filename ? '：' + msg.filename : '');
    } else if (msg.type === 'DOWNLOAD_DONE') {
      progressEl.classList.add('hidden');
      downloadBtn.disabled = false;
      resultEl.classList.remove('hidden');
      resultEl.textContent =
        '下载完成：成功 ' + msg.success + ' 张，失败 ' + msg.failed + ' 张（共 ' + msg.total + ' 张）。';
    }
  }
})();
