/* ورد — أدوات مشتركة بين صفحة المتجر ولوحة الأدمن
   (الثيمات، الإعدادات، الاتصال بـ Google Sheets، التشفير، الرسومات) */
(function () {
  "use strict";
  const C = window.WARD_CONFIG || {};
  const W = (window.Ward = {});
  const LS_SETTINGS = "ward_settings_v1";   // نسخة محلية من الإعدادات
  const LS_ORDERS = "ward_orders_local_v1"; // طلبات الوضع التجريبي

  /* ---------- أدوات عامة ---------- */
  W.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  W.clone = (o) => JSON.parse(JSON.stringify(o));
  W.merge = function merge(base, over) {
    if (over === undefined || over === null) return W.clone(base);
    if (Array.isArray(base) || Array.isArray(over) || typeof base !== "object" || typeof over !== "object") return W.clone(over);
    const out = W.clone(base);
    Object.keys(over).forEach((k) => { out[k] = k in base ? merge(base[k], over[k]) : W.clone(over[k]); });
    return out;
  };
  W.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  W.hasApi = () => !!(C.API_URL && /^https:\/\//.test(C.API_URL));
  W.money = (n, cur) => (n == null || n === "" ? "—" : Number(n).toLocaleString("en-US") + " " + (cur || "₪"));

  /* ---------- الألوان والثيمات ---------- */
  function hexToHsl(hex) {
    let h = String(hex || "#888").replace("#", "");
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let H = 0, S = 0; const L = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
      H = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      H *= 60;
    }
    return { h: H, s: S * 100, l: L * 100, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
  }
  const hsl = (h, s, l) => `hsl(${h.toFixed(1)} ${Math.max(0, Math.min(100, s)).toFixed(1)}% ${Math.max(0, Math.min(100, l)).toFixed(1)}%)`;

  W.themeVars = function (hex) {
    const { h, s, l, lum } = hexToHsl(hex);
    const sat = Math.min(s, 70);
    return {
      "--p": hex,
      "--p-600": hsl(h, s, l - 8),
      "--p-700": hsl(h, s, Math.min(l - 16, 34)),
      "--p-ink": hsl(h, Math.min(s, 55), Math.min(l, 36)),  // نص ملوّن بتباين كافٍ على الأبيض
      "--p-400": hsl(h, s, l + 10),
      "--p-300": hsl(h, sat, Math.max(l + 22, 72)),
      "--p-200": hsl(h, sat, 85),
      "--p-100": hsl(h, sat * 0.8, 92),
      "--p-50": hsl(h, sat * 0.7, 96.5),
      "--bg": hsl(h, sat * 0.45, 98.4),
      "--ink": hsl(h, Math.min(s, 35), 13),
      "--ink-2": hsl(h, Math.min(s, 18), 32),
      "--muted": hsl(h, Math.min(s, 12), 46),
      "--line": hsl(h, sat * 0.4, 88),
      "--on-p": lum > 0.6 ? hsl(h, 40, 14) : "#ffffff"
    };
  };
  W.applyTheme = function (hex, origin) {
    const set = () => {
      const vars = W.themeVars(hex);
      Object.keys(vars).forEach((k) => document.documentElement.style.setProperty(k, vars[k]));
      const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", hex);
    };
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (origin && document.startViewTransition && !reduce) {
      const x = origin.clientX || innerWidth / 2, y = origin.clientY || innerHeight / 2;
      document.documentElement.style.setProperty("--vt-x", x + "px");
      document.documentElement.style.setProperty("--vt-y", y + "px");
      try { document.startViewTransition(set); return; } catch (e) {}
    }
    set();
  };

  /* لون ثيم الموقع العام (siteTheme) — منفصل عن ألوان الطقم */
  W.siteThemeHex = function (S) {
    if (S && typeof S.siteTheme === "string" && /^#[0-9a-f]{6}$/i.test(S.siteTheme)) return S.siteTheme;
    const t = S && S.defaultTheme; // توافق مع النسخ القديمة
    if (typeof t === "string" && /^#[0-9a-f]{6}$/i.test(t)) return t;
    const c = (S.colors || []).find((x) => x.id === t) || (S.colors || [])[0];
    return c ? c.hex : "#D9809A";
  };

  /* ---------- الإعدادات (المحتوى) ---------- */
  W.defaults = () => W.clone(C.DEFAULTS || {});
  W.localSettings = () => W.store.get(LS_SETTINGS, null);
  W.saveLocalSettings = (s) => W.store.set(LS_SETTINGS, s);
  W.clearLocalSettings = () => W.store.del(LS_SETTINGS);
  /* بترجع الإعدادات فورًا من النسخة المحلية، وبتستدعي onRemote لما توصل النسخة من السيرفر */
  /* الدفع عند الاستلام فقط: بيشيل أي ذكر للفيزا/البطاقات من المحتوى، حتى لو كان محفوظ من قبل */
  const VISA_RE = /\s*(?:،|,)?\s*(?:أو|و)\s*(?:بال|ب)?(?:فيزا|بطاقة|بطاقات|visa)[^.،\n•]*/gi;
  W.cleanSettings = function (S) {
    if (!S || typeof S !== "object") return S;
    const fix = (v) => typeof v === "string" ? v.replace(VISA_RE, "").replace(/\s{2,}/g, " ").trim() : Array.isArray(v) ? v.map(fix) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : v;
    const out = fix(S);
    out.payments = (Array.isArray(S.payments) ? S.payments : []).filter((p) => !/فيزا|بطاق|visa/i.test(String(p)));
    if (!out.payments.length) out.payments = ["الدفع عند الاستلام"];
    (out.faq || []).forEach((f) => { if (/كيف بدفع|طريقة الدفع/.test(f.q || "")) f.a = "الدفع نقدًا عند الاستلام، لما يوصلك الطلب."; });
    return out;
  };
  W.loadSettings = function (onRemote) {
    const local = W.localSettings();
    const now = W.cleanSettings(W.merge(W.defaults(), local && local.data ? local.data : null));
    if (W.hasApi()) {
      W.api.get("settings").then((r) => {
        if (r && r.ok && r.settings) {
          W.saveLocalSettings({ data: r.settings, from: "server", at: Date.now() });
          onRemote && onRemote(W.cleanSettings(W.merge(W.defaults(), r.settings)));
        }
      }).catch(() => {});
    }
    return now;
  };

  /* ---------- الاتصال بـ Google Apps Script ---------- */
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }
  W.api = {
    async get(action, params) {
      const u = new URL(C.API_URL);
      u.searchParams.set("action", action);
      Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
      const res = await withTimeout(fetch(u.toString(), { method: "GET" }), 12000);
      return res.json();
    },
    async post(action, payload) {
      // text/plain يتجنب طلب CORS المسبق، وهذا المطلوب مع Apps Script
      const res = await withTimeout(fetch(C.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, payload: JSON.stringify(payload || {}) })
      }), 15000);
      return res.json();
    },
    /* طلب أدمن موقّع بـ HMAC-SHA256 — المفتاح ما بينبعت أبدًا، بس التوقيع */
    async signed(action, payload, keyHex) {
      const p = JSON.stringify(payload || {});
      const ts = String(Date.now());
      const nonce = W.crypto.randomHex(12);
      const sig = await W.crypto.hmac(keyHex, [action, ts, nonce, p].join("|"));
      const res = await withTimeout(fetch(C.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, payload: p, ts, nonce, sig })
      }), 20000);
      return res.json();
    }
  };

  /* ---------- التشفير ---------- */
  const hexToBytes = (hex) => new Uint8Array((hex.match(/.{2}/g) || []).map((b) => parseInt(b, 16)));
  const bytesToHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  W.crypto = {
    randomHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return bytesToHex(a); },
    /* PBKDF2-SHA256 → 512 بت: النصف الأول للتحقق (verifier)، والنصف الثاني مفتاح التوقيع (key) */
    async derive(password, saltHex, iterations) {
      const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = new Uint8Array(await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: iterations || 210000 }, base, 512));
      const verifier = bytesToHex(await crypto.subtle.digest("SHA-256", bits.slice(0, 32)));
      return { verifier, key: bytesToHex(bits.slice(32)) };
    },
    async hmac(keyHex, msg) {
      const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(keyHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return bytesToHex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
    },
    async newCredentials(password) {
      const salt = W.crypto.randomHex(16), iterations = 210000;
      const d = await W.crypto.derive(password, salt, iterations);
      return { salt, iterations, verifier: d.verifier, key: d.key };
    }
  };

  /* ---------- التسعير ---------- */
  W.priceFor = function (qty, product) {
    const u = Number(product.unitPrice) || 0, pair = Number(product.pairPrice) || u * 2;
    return Math.floor(qty / 2) * pair + (qty % 2) * u;
  };

  /* ---------- طلبات الوضع التجريبي ---------- */
  W.localOrders = {
    all: () => W.store.get(LS_ORDERS, []),
    add(o) { const a = W.localOrders.all(); a.unshift(o); W.store.set(LS_ORDERS, a); },
    save(a) { W.store.set(LS_ORDERS, a); }
  };
  W.newOrderId = function () {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return "W" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + W.crypto.randomHex(2).toUpperCase();
  };

  /* ---------- رقم الجوال ---------- */
  W.telLink = (ph) => "tel:" + String(ph || "").replace(/[^\d+]/g, "");

  /* ---------- رسمة الشنطة (SVG) ----------
     hex = لون محدد، أو null عشان تتلون تلقائيًا بلون الثيم الحالي */
  let uid = 0;
  W.bagSVG = function (hex, opts) {
    opts = opts || {};
    const id = "b" + (++uid);
    let c1, c2, c3, tint, lace;
    if (hex) {
      const { h, s, l } = hexToHsl(hex);
      c1 = hsl(h, s, l + 12); c2 = hex; c3 = hsl(h, s, l - 10);
      tint = hsl(h, Math.min(s, 60), 90); lace = hsl(h, Math.min(s, 40), 97);
    } else {
      c1 = "var(--p-400)"; c2 = "var(--p)"; c3 = "var(--p-600)"; tint = "var(--p-100)"; lace = "var(--p-50)";
    }
    const st = (v) => `style="stop-color:${v}"`;
    const fl = (v) => `style="fill:${v}"`;
    return `
<svg viewBox="0 0 320 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${W.esc(opts.label || "شنطة طقم الصلاة")}" class="bag-svg">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" ${st(c1)}/><stop offset=".55" ${st(c2)}/><stop offset="1" ${st(c3)}/></linearGradient>
    <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" ${st(lace)}/><stop offset="1" ${st(tint)}/></linearGradient>
    <radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="160" cy="282" rx="118" ry="13" fill="url(#${id}s)"/>
  <!-- القماش المطوي ظاهر من الشنطة -->
  <g class="bag-fabric">
    <path d="M78 104 C88 62 120 46 160 46 C200 46 232 62 242 104 Z" fill="url(#${id}f)"/>
    <path d="M96 104 C104 74 128 62 160 62 C192 62 216 74 224 104 Z" ${fl(tint)} opacity=".9"/>
    <g ${fl(lace)} opacity=".95">${Array.from({ length: 11 }, (_, i) => {
      const t = i / 10, x = 84 + t * 152, y = 100 - Math.sin(t * Math.PI) * 50;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2"/>`; }).join("")}</g>
  </g>
  <!-- جسم الشنطة -->
  <path d="M44 116 Q44 96 64 96 H256 Q276 96 276 116 L266 248 Q264 270 242 270 H78 Q56 270 54 248 Z" fill="url(#${id}g)"/>
  <path d="M60 120 Q60 110 70 110 H250 Q260 110 260 120 L252 244 Q251 256 239 256 H81 Q69 256 68 244 Z" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-dasharray="6 6"/>
  <!-- السحّاب -->
  <path d="M58 104 H262" stroke="${hex ? c3 : "var(--p-700)"}" stroke-width="7" stroke-linecap="round" opacity=".55"/>
  <path d="M58 104 H262" stroke="#fff" stroke-width="3" stroke-dasharray="3 4" opacity=".6"/>
  <g class="bag-pull"><rect x="236" y="100" width="12" height="30" rx="6" fill="#f4f1ea" stroke="#0002"/><circle cx="242" cy="106" r="3" fill="#0003"/></g>
  <!-- وردة مطرزة -->
  <g transform="translate(160 184)" class="bag-rose">
    <path d="M-6 18 C-22 22 -36 16 -42 4 C-28 0 -16 6 -8 14 Z M6 18 C22 22 36 16 42 4 C28 0 16 6 8 14 Z" fill="#fff" fill-opacity=".6"/>
    <g fill="#fff" fill-opacity=".92">${[0,72,144,216,288].map((a)=>`<ellipse cx="0" cy="-11" rx="11" ry="13" transform="rotate(${a})"/>`).join("")}</g>
    <circle r="11" fill="${hex ? tint : "var(--p-100)"}"/>
    <path d="M1 -7 C7 -6 8 1 4 5 C0 8 -6 6 -6 0 C-6 -4 -2 -6 1 -4 C3 -2 2 1 0 1" fill="none" stroke="${hex ? c3 : "var(--p-700)"}" stroke-width="2.4" stroke-linecap="round"/>
  </g>
  <!-- علّاقة -->
  <path d="M44 150 C22 150 18 182 44 186" fill="none" stroke="${hex ? c3 : "var(--p-700)"}" stroke-width="6" stroke-linecap="round" opacity=".7"/>
  <ellipse cx="104" cy="132" rx="34" ry="12" fill="#fff" opacity=".18" transform="rotate(-12 104 132)"/>
</svg>`;
  };

  /* ---------- أيقونات (نمط Lucide) ---------- */
  const P = {
    bag: '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 21a2.5 2.5 0 0 1 0-5h2a3 3 0 0 0 3-3"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    plane: '<path d="M10.5 13.5 4 11l1.5-1.5 7 1 4-4a2.1 2.1 0 0 1 3 3l-4 4 1 7L16 22l-2.5-6.5-3 3V21l-1.5 1-1-3.5L4.5 17.5 6 16h2.5z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 9h15"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', chevron: '<path d="m15 6-6 6 6 6"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'
  };
  W.icon = (name, cls) => `<svg class="ico ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.sparkle}</svg>`;
})();
