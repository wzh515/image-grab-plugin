// background.js — Service Worker（Manifest V3）
// 职责：
//   1. 接收 content.js 发送的 OPEN_GALLERY 消息，保存图片列表并打开画廊页
//   2. 接收 gallery.js 发送的 DOWNLOAD_IMAGES 消息，批量下载并统一转为 PNG
//   3. 向画廊页回报下载进度与结果

// 点击工具栏图标时打开画廊页（即使当前不在商品页也能查看上次结果）
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_GALLERY') {
    // 内容脚本提取到的图片列表 -> 存入 storage -> 打开画廊页
    chrome.storage.local.set({ images: msg.images || [] }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
    });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'DOWNLOAD_IMAGES') {
    // 画廊页发起的批量下载（异步执行，不阻塞消息通道）
    downloadAll(msg.images || []);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

// 数字补零：1 -> 001
function pad(n, len = 3) {
  return String(n).padStart(len, '0');
}

// 拉取图片二进制（借助 host_permissions，可跨域读取电商 CDN 图片）
async function fetchAsBlob(url) {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.blob();
}

// 统一转为 PNG：非 PNG 图片通过 OffscreenCanvas 重绘导出
async function convertToPng(blob) {
  if (blob.type === 'image/png') return blob; // 已是 PNG，直接使用
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await canvas.convertToBlob({ type: 'image/png' });
}

// Blob -> DataURL（Service Worker 中对象 URL 生命周期不可靠，用 DataURL 更稳妥）
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// 批量下载
async function downloadAll(images) {
  const total = images.length;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const img = images[i];
    const filename = '商品图_' + pad(i + 1) + '.png';
    send({
      type: 'DOWNLOAD_PROGRESS',
      current: i + 1,
      total,
      filename,
      url: img.url,
      status: 'downloading'
    });

    try {
      const blob = await fetchAsBlob(img.url);
      const png = await convertToPng(blob);
      const dataUrl = await blobToDataURL(png);
      await chrome.downloads.download({
        url: dataUrl,
        filename,
        conflictAction: 'uniquify',
        saveAs: false
      });
      success++;
      send({
        type: 'DOWNLOAD_PROGRESS',
        current: i + 1,
        total,
        filename,
        url: img.url,
        status: 'ok'
      });
    } catch (err) {
      failed++;
      send({
        type: 'DOWNLOAD_PROGRESS',
        current: i + 1,
        total,
        filename,
        url: img.url,
        status: 'fail',
        error: String((err && err.message) || err)
      });
    }
  }

  send({ type: 'DOWNLOAD_DONE', success, failed, total });
}

// 向所有扩展页面广播消息（画廊页监听）
function send(payload) {
  try {
    chrome.runtime.sendMessage(payload).catch(() => {});
  } catch (e) {
    // 无监听者时忽略
  }
}
