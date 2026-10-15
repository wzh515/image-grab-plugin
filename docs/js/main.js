// main.js — 图提取 ImageGrab 官网交互脚本
// 功能：移动端菜单 / 导航吸顶 / 滚动高亮 / 滚动入场动画

(function () {
  'use strict';

  var navbar = document.getElementById('navbar');
  var menuToggle = document.getElementById('menuToggle');
  var nav = document.getElementById('nav');

  /* ============================================================
     1. 移动端汉堡菜单：切换展开 / 收起
     ============================================================ */
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuToggle.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    });

    // 点击导航链接后自动收起菜单（移动端体验）
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        menuToggle.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ============================================================
     2. 导航吸顶：滚动后给导航栏添加毛玻璃背景与阴影
     ============================================================ */
  function onScroll() {
    if (window.scrollY > 10) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // 初始执行一次

  /* ============================================================
     3. 滚动高亮：监听各区块，给当前导航链接加 .active
     ============================================================ */
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav-link[href^="#"]');

  // 建立 id -> 导航链接 的映射（排除「下载插件」这类指向 CTA 的链接，仍参与高亮）
  var linkMap = {};
  navLinks.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    if (id) linkMap[id] = link;
  });

  if ('IntersectionObserver' in window && sections.length) {
    var spyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var currentId = entry.target.id;
            navLinks.forEach(function (link) {
              link.classList.toggle('active', link.getAttribute('href') === '#' + currentId);
            });
          }
        });
      },
      // 顶部留出导航高度，当区块进入视口中部偏上时判定为当前
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    sections.forEach(function (sec) {
      spyObserver.observe(sec);
    });
  }

  /* ============================================================
     4. 滚动入场动画：元素进入视口时添加 .visible 触发淡入上移
     ============================================================ */
  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealEls.length) {
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target); // 只触发一次，避免重复
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    // 兜底：不支持 IntersectionObserver 时直接全部显示
    revealEls.forEach(function (el) {
      el.classList.add('visible');
    });
  }
})();
