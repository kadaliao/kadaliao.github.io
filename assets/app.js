/* ============================================================
   kadaliao.github.io — 交互
   没有依赖，没有构建。
   ============================================================ */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ── 导航落影 ───────────────────────────────────────────── */
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 8);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  /* ── 逐块浮现 ───────────────────────────────────────────── */
  const revealables = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((el) => io.observe(el));
  }

  /* ── 光标光斑 + 卡片高光 ────────────────────────────────── */
  if (canHover && !reduceMotion) {
    const glow = $('.glow');
    let mx = -999, my = -999, pending = false, shown = false;

    const paint = () => {
      pending = false;
      if (glow) {
        glow.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
        if (!shown) { glow.classList.add('on'); shown = true; }
      }
    };

    addEventListener('pointermove', (event) => {
      mx = event.clientX;
      my = event.clientY;
      if (!pending) { pending = true; requestAnimationFrame(paint); }
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      if (glow) { glow.classList.remove('on'); shown = false; }
    });

    $$('.card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        card.style.setProperty('--my', `${event.clientY - rect.top}px`);
      }, { passive: true });
    });
  }

  /* ── GitHub 数据：星标数 + 最近更新 ─────────────────────── */
  const CACHE_KEY = 'kada:repos:v1';
  const CACHE_TTL = 6 * 60 * 60 * 1000;

  const relative = (iso) => {
    const then = new Date(iso).getTime();
    if (!then) return '';
    const mins = Math.round((Date.now() - then) / 60000);
    if (mins < 60) return '刚刚';
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.round(hours / 24);
    if (days < 31) return `${days} 天前`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} 个月前`;
    return `${Math.round(months / 12)} 年前`;
  };

  const paintRepos = (map) => {
    if (!map) return;

    // 星标：data-repo 可以写多个仓库（开心果三个平台），加起来
    $$('.stars[data-repo]').forEach((node) => {
      const total = node.dataset.repo.split(/\s+/)
        .reduce((sum, name) => sum + (map[name]?.stargazers_count || 0), 0);
      if (total > 0) {
        node.textContent = total;
        node.title = `${total} 个星标`;
      }
    });

    // 最近更新：在列出的仓库里挑最近 push 的那个，名字用卡片标题
    const last = $('#last-push');
    if (last?.dataset.repos) {
      const newest = last.dataset.repos.split(/\s+/)
        .filter((name) => map[name]?.pushed_at)
        .sort((a, b) => new Date(map[b].pushed_at) - new Date(map[a].pushed_at))[0];
      if (newest) {
        const card = $(`.stars[data-repo~="${newest}"]`)?.closest('.card');
        const label = card ? $('h3', card).textContent.trim() : newest;
        const ago = relative(map[newest].pushed_at);
        if (ago) last.textContent = `${label} · ${ago}`;
      }
    }
  };

  const loadRepos = async () => {
    let cached = null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() - parsed.t < CACHE_TTL) cached = parsed.map;
      }
    } catch { /* localStorage 不可用就当没缓存 */ }

    if (cached) { paintRepos(cached); return; }

    try {
      const res = await fetch('https://api.github.com/users/kadaliao/repos?per_page=100&sort=pushed', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) return;
      const list = await res.json();
      const map = {};
      list.forEach((repo) => {
        map[repo.name] = {
          stargazers_count: repo.stargazers_count,
          pushed_at: repo.pushed_at,
          language: repo.language,
        };
      });
      paintRepos(map);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), map })); } catch {}
    } catch { /* 离线就保持静态文案 */ }
  };
  loadRepos();

  /* ── toast ─────────────────────────────────────────────── */
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (text) => {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
  };

  /* ── 复制安装命令 ──────────────────────────────────────── */
  $$('.copy-btn').forEach((btn) => {
    const label = $('.copy-state', btn);
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        ta.remove();
      }
      if (label) {
        label.textContent = label.dataset.done || '已复制';
        label.classList.add('done');
        setTimeout(() => {
          label.textContent = label.dataset.idle || '复制';
          label.classList.remove('done');
        }, 1800);
      }
      toast(`$ ${text}`);
    });
  });

  /* ── 命令面板 ──────────────────────────────────────────── */
  const palette = $('#palette');
  const input = $('#palette-input');
  const listEl = $('#palette-list');

  const buildItems = () => {
    const items = $$('.card').map((card) => {
      const stars = $('.stars', card)?.textContent.trim();
      return {
        label: $('h3', card).textContent.trim(),
        meta: [$$('.lang', card).map((n) => n.textContent.trim()).join(' / '), stars && `${stars} ★`, 'GitHub']
          .filter(Boolean).join(' · '),
        href: card.getAttribute('href') || $('.card-link', card)?.getAttribute('href'),
        external: true,
        desc: $('.card-desc', card)?.textContent.trim() || '',
      };
    });

    // 开心果的各平台仓库
    $$('.plats a').forEach((link) => {
      items.push({ label: link.dataset.label || link.textContent.trim(), meta: 'GitHub', href: link.getAttribute('href'), external: true });
    });

    [['应用', '#apps'], ['插件', '#plugins'], ['最近发布', '#recent'], ['关于', '#about']].forEach(([label, href]) => {
      items.push({ label, meta: '页面内', href, external: false });
    });

    items.push({ label: 'GitHub 全部仓库', meta: 'github.com', href: 'https://github.com/kadaliao?tab=repositories', external: true });
    return items;
  };

  let items = [];
  let cursor = 0;
  let filtered = [];

  const render = () => {
    const q = input.value.trim().toLowerCase();
    filtered = q
      ? items.filter((item) => `${item.label} ${item.desc || ''} ${item.meta}`.toLowerCase().includes(q))
      : items;
    cursor = Math.min(cursor, Math.max(filtered.length - 1, 0));
    listEl.innerHTML = '';
    filtered.forEach((item, index) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(index === cursor));
      const name = document.createElement('span');
      name.textContent = item.label;
      const meta = document.createElement('span');
      meta.className = 'pl-meta';
      meta.textContent = item.meta;
      li.append(name, meta);
      li.addEventListener('click', () => go(item));
      li.addEventListener('pointermove', () => {
        if (cursor === index) return;
        cursor = index;
        $$('li', listEl).forEach((node, i) => node.setAttribute('aria-selected', String(i === cursor)));
      });
      listEl.appendChild(li);
    });
  };

  const go = (item) => {
    if (!item) return;
    closePalette();
    if (item.external) {
      window.open(item.href, '_blank', 'noopener');
    } else {
      location.hash = item.href;
      $(item.href)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const openPalette = () => {
    items = buildItems();
    cursor = 0;
    input.value = '';
    palette.hidden = false;
    render();
    input.focus();
    document.body.style.overflow = 'hidden';
  };

  function closePalette() {
    palette.hidden = true;
    document.body.style.overflow = '';
  }

  $('#palette-open')?.addEventListener('click', openPalette);
  $('#palette-open-2')?.addEventListener('click', openPalette);
  $('[data-close]', palette)?.addEventListener('click', closePalette);
  input?.addEventListener('input', () => { cursor = 0; render(); });
  input?.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        cursor = Math.min(cursor + 1, filtered.length - 1);
        render();
        break;
      case 'ArrowUp':
        event.preventDefault();
        cursor = Math.max(cursor - 1, 0);
        render();
        break;
      case 'Enter':
        event.preventDefault();
        go(filtered[cursor]);
        break;
      case 'Escape':
        event.preventDefault();
        closePalette();
        break;
    }
  });

  addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      palette.hidden ? openPalette() : closePalette();
      return;
    }
    if (event.key === 'Escape' && !palette.hidden) { closePalette(); return; }
    if (event.key === '/' && !typing && palette.hidden) {
      event.preventDefault();
      openPalette();
    }
  });
})();
