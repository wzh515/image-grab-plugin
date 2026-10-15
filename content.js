// content.js — 内容脚本（Manifest V3）
// 功能：
//   1. 仅在商品详情页右下角注入「获取图片」悬浮按钮
//   2. 点击后扫描页面中所有商品图片并去重、过滤
//   3. 通过 chrome.runtime.sendMessage 把图片列表交给后台（background.js）

(() => {
  // 防止重复注入
  if (window.__imgGrabInjected) return;
  window.__imgGrabInjected = true;

  const BTN_ID = 'img-grab-btn';
  const MIN_SIZE = 100; // 小于 100x100 的图片视为无用（图标/占位图）

  // ---- 平台判断 ----
  function host() {
    return location.hostname.toLowerCase();
  }
  function isTaobao() {
    return /(^|\.)(taobao|tmall)\.com$/.test(host());
  }
  function isJd() {
    return /(^|\.)jd\.com$/.test(host());
  }
  function isPdd() {
    return /(^|\.)(pinduoduo|yangkeduo)\.com$/.test(host());
  }

  // 是否商品详情页（各平台 URL 特征不同，做兼容判断）
  function isProductDetailPage() {
    const href = location.href;
    const path = location.pathname;
    if (isTaobao()) {
      // 淘宝/天猫：item.htm / item.taobao.com / detail 路径
      return /\/item\.htm|item\.taobao\.com|item\.tmall\.com|\/detail\//i.test(href);
    }
    if (isJd()) {
      // 京东：item.jd.com 或 /12345678.html 这类 SKU 详情
      return /\/item\/|item\.jd\.com|\/\d{6,}\.html/i.test(href);
    }
    if (isPdd()) {
      // 拼多多/拼多多商家版：goods.html / goods2.html / goods_id=xxx
      return /\/goods\d*\.html|goods_id=/i.test(href) || /\/goods\//i.test(path);
    }
    return false;
  }

  // ---- 注入悬浮按钮 ----
  function createButton() {
    let btn = document.getElementById(BTN_ID);
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = '获取图片';
    btn.title = '提取当前页面的商品图片';
    btn.addEventListener('click', onGrab);
    (document.body || document.documentElement).appendChild(btn);
    return btn;
  }

  function onGrab(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    btn.classList.add('loading');
    btn.textContent = '提取中…';

    // 让按钮文案先渲染，再执行较耗时的提取
    setTimeout(() => {
      try {
        const images = extractImages();
        btn.textContent = '获取图片';
        btn.classList.remove('loading');
        chrome.runtime.sendMessage({ type: 'OPEN_GALLERY', images }).catch(() => {});
      } catch (err) {
        btn.textContent = '获取图片';
        btn.classList.remove('loading');
        console.error('[图片提取] 提取失败：', err);
      }
    }, 30);
  }

  // ---- 图片提取 ----
  function extractImages() {
    const map = new Map(); // url -> { url, width, height }

    // 明显非商品图的 URL 关键词（图标/logo/占位图等）
    const blacklist =
      /icon|logo|avatar|sprite|qrcode|placeholder|favicon|loading|pixel|blank|spacer|emoji|1x1|lazy\.gif|\/btn|\/share/i;

    function add(url, w, h) {
      if (!url || typeof url !== 'string') return;
      url = url.trim();
      if (!url) return;
      // 跳过非真实图片地址
      if (/^(data:|blob:|javascript:|about:)/i.test(url)) return;

      let abs;
      try {
        abs = new URL(url, location.href).href; // 相对路径补全为绝对 URL
      } catch (err) {
        return;
      }
      if (!/^https?:/i.test(abs)) return;
      if (blacklist.test(abs)) return;

      const prev = map.get(abs);
      const width = Math.max(prev ? prev.width : 0, w || 0);
      const height = Math.max(prev ? prev.height : 0, h || 0);
      map.set(abs, { url: abs, width, height });
    }

    // 1) <img> 标签（含懒加载属性、srcset、currentSrc）
    const lazyAttrs = [
      'src',
      'data-src',
      'data-lazy-src',
      'data-lazy',
      'data-original',
      'data-url',
      'data-echo',
      'data-img',
      'data-ks-lazyload',
      'data-actualsrc'
    ];
    document.querySelectorAll('img').forEach((img) => {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;

      lazyAttrs.forEach((a) => {
        const v = img.getAttribute(a);
        if (v) add(v, w, h);
      });

      // 当前实际渲染地址（可能来自 <picture>/srcset）
      if (img.currentSrc) add(img.currentSrc, w, h);

      // srcset：取其中所有候选地址
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        srcset.split(',').forEach((part) => {
          const u = part.trim().split(/\s+/)[0];
          if (u) add(u, w, h);
        });
      }
    });

    // 2) 背景图 background-image（inline 样式 + 样式表），并兼容懒加载背景属性
    const urlRe = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    const bgAttrs = [
      'data-background',
      'data-bg',
      'data-lazy-background',
      'data-original',
      'data-bg-image'
    ];
    document.querySelectorAll('*').forEach((el) => {
      bgAttrs.forEach((a) => {
        const v = el.getAttribute(a);
        if (v) add(v, 0, 0);
      });

      let bg;
      try {
        bg = getComputedStyle(el).backgroundImage;
      } catch (err) {
        return;
      }
      if (!bg || bg === 'none') return;

      let m;
      urlRe.lastIndex = 0;
      while ((m = urlRe.exec(bg)) !== null) {
        if (m[2]) add(m[2], 0, 0);
      }
    });

    // 3) 输出：过滤掉已知尺寸过小的图片（背景图尺寸未知时保留，交给画廊页二次判断）
    const result = [];
    map.forEach((item) => {
      if (item.width > 0 && item.height > 0 && (item.width < MIN_SIZE || item.height < MIN_SIZE)) {
        return;
      }
      result.push(item);
    });

    return result;
  }

  // ---- SPA 页面地址变化时，重新判断是否显示按钮 ----
  function toggleButton() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.style.display = isProductDetailPage() ? '' : 'none';
  }

  function init() {
    createButton();
    toggleButton();

    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        toggleButton();
      }
    }, 1500);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
