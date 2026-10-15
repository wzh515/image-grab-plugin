# 电商图片提取下载

在淘宝 / 京东 / 拼多多（含商家版）商品详情页一键提取所有商品图片，并在新页面中勾选、批量下载为 PNG。

## 文件结构

```
manifest.json   Manifest V3 清单
content.js      注入「获取图片」按钮 + 提取图片
content.css     悬浮按钮样式
background.js   Service Worker：消息转发 + 批量下载（转 PNG）
gallery.html    画廊页结构
gallery.css     画廊页样式
gallery.js      画廊页逻辑（展示 / 勾选 / 下载）
```

## 安装

1. 打开 Chrome，地址栏输入 `chrome://extensions` 回车。
2. 打开右上角「开发者模式」开关。
3. 点击左上角「加载已解压的扩展程序」，选择本目录（`image‑grab‑plugin`）。
4. 安装完成后，工具栏会出现该扩展的图标。

## 使用

1. 进入淘宝 / 京东 / 拼多多的**商品详情页**，右下角会出现「获取图片」悬浮按钮。
2. 点击按钮，插件扫描页面图片并自动打开画廊页。
3. 在画廊页勾选需要的图片（支持「全选」「反选」，点击缩略图也可切换勾选）。
4. 点击「下载选中」，图片会统一转为 PNG 并按 `商品图_001.png`、`商品图_002.png`… 保存到默认下载目录。

## 说明

- 图片来源覆盖 `<img>`、`srcset`、`data-src` / `data-lazy-src` 等懒加载属性、以及 `background-image` 背景图。
- 自动过滤图标 / logo / 占位图 / 1x1 像素图及小于 100×100 的图片。
- `host_permissions` 除三大平台域名外，额外声明了 `http://*/*`、`https://*/*`，用于在 Service Worker 中跨域读取电商 CDN 图片并完成 PNG 转换；如你希望收紧权限，可将其替换为具体图片 CDN 域名（如 `*.alicdn.com`、`*.360buyimg.com` 等）。
