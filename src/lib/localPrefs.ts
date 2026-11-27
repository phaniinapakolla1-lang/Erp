export type ThemeMode = 'light' | 'dark' | 'glass-dark';
export type WallpaperToneMode = 'auto' | 'light' | 'dark';

export interface AccessibilityPrefs {
  fontScale: number; // 90, 100, 115, 130
  readerMode: boolean;
  highContrast: boolean;
}

export function setCookie(name: string, value: string, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const sec = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${sec}`;
}

export function getCookie(name: string): string {
  const prefix = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return '';
}

export function deleteCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

const WALLPAPER_KEY = 'erp-custom-wallpaper';
const WALLPAPER_COOKIE = 'erp_wallpaper_url';
const WALLPAPER_BLUR_KEY = 'erp-wallpaper-blur';
const WALLPAPER_TONE_KEY = 'erp-wallpaper-tone';
const WALLPAPER_DETECTED_KEY = 'erp-wallpaper-detected-tone';
const GLASS_VIS_KEY = 'erp-glass-visibility';
const GLASS_VIS_COOKIE = 'erp_glass_vis';
const A11Y_KEY = 'erp-a11y-prefs';

export function loadLocalWallpaper(): string {
  return localStorage.getItem(WALLPAPER_KEY) || getCookie(WALLPAPER_COOKIE) || '';
}

export function loadWallpaperBlur(): number {
  const raw = localStorage.getItem(WALLPAPER_BLUR_KEY);
  const n = Number(raw);
  return raw !== null && Number.isFinite(n) && n >= 0 && n <= 16 ? Math.round(n) : 2;
}

export function saveWallpaperBlur(px: number) {
  const clamped = Math.max(0, Math.min(16, Math.round(px)));
  localStorage.setItem(WALLPAPER_BLUR_KEY, String(clamped));
  document.documentElement.style.setProperty('--wallpaper-blur', `${clamped}px`);
}

export function loadWallpaperToneMode(): WallpaperToneMode {
  const v = localStorage.getItem(WALLPAPER_TONE_KEY);
  return v === 'light' || v === 'dark' ? v : 'auto';
}

export function saveWallpaperToneMode(mode: WallpaperToneMode) {
  localStorage.setItem(WALLPAPER_TONE_KEY, mode);
  applyWallpaperToneToDom();
}

export function applyWallpaperToneToDom() {
  const hasWp = Boolean(loadLocalWallpaper());
  if (!hasWp) {
    document.documentElement.removeAttribute('data-wallpaper-tone');
    return;
  }
  const pref = loadWallpaperToneMode();
  const detected = localStorage.getItem(WALLPAPER_DETECTED_KEY) === 'light' ? 'light' : 'dark';
  const effective = pref === 'auto' ? detected : pref;
  document.documentElement.setAttribute('data-wallpaper-tone', effective);
}

/** Sample average brightness of an image on an offscreen canvas to determine whether text should be dark (light wallpaper) or light (dark wallpaper). */
export function detectWallpaperTone(urlOrDataUrl: string): Promise<'light' | 'dark'> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve('dark');
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve('dark'); return; }
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let sum = 0;
        const pxCount = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          // Relative luminance (Rec. 709)
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        const avg = sum / pxCount;
        resolve(avg >= 145 ? 'light' : 'dark');
      } catch {
        // Cross-origin remote image without CORS headers
        resolve('dark');
      }
    };
    img.src = urlOrDataUrl;
  });
}

export function saveLocalWallpaper(urlOrDataUrl: string) {
  const val = urlOrDataUrl.trim();
  if (!val) {
    localStorage.removeItem(WALLPAPER_KEY);
    localStorage.removeItem(WALLPAPER_DETECTED_KEY);
    deleteCookie(WALLPAPER_COOKIE);
    applyWallpaperToDom('');
    return;
  }
  localStorage.setItem(WALLPAPER_KEY, val);
  if (val.length < 2000 && !val.startsWith('data:')) {
    setCookie(WALLPAPER_COOKIE, val, 60);
  } else {
    deleteCookie(WALLPAPER_COOKIE);
  }
  applyWallpaperToDom(val);
  void detectWallpaperTone(val).then((tone) => {
    localStorage.setItem(WALLPAPER_DETECTED_KEY, tone);
    applyWallpaperToneToDom();
  });
}

export function applyWallpaperToDom(val: string) {
  document.documentElement.style.setProperty('--wallpaper-blur', `${loadWallpaperBlur()}px`);
  if (val) {
    document.documentElement.style.setProperty('--erp-wallpaper', `url("${val.replace(/"/g, '\\"')}")`);
    document.documentElement.setAttribute('data-has-wallpaper', 'true');
    applyWallpaperToneToDom();
  } else {
    document.documentElement.style.removeProperty('--erp-wallpaper');
    document.documentElement.removeAttribute('data-has-wallpaper');
    document.documentElement.removeAttribute('data-wallpaper-tone');
  }
}

/** Glass visibility control from -150% (ultra transparent) to +150% (heavily frosted/opaque). */
export function loadGlassVisibility(): number {
  const raw = localStorage.getItem(GLASS_VIS_KEY) ?? getCookie(GLASS_VIS_COOKIE);
  const n = Number(raw);
  if (Number.isFinite(n) && n >= -150 && n <= 150) return Math.round(n);
  return 0;
}

export function saveGlassVisibility(val: number) {
  const clamped = Math.max(-150, Math.min(150, Math.round(val)));
  localStorage.setItem(GLASS_VIS_KEY, String(clamped));
  setCookie(GLASS_VIS_COOKIE, String(clamped), 60);
  applyGlassVisibilityToDom(clamped);
}

export function applyGlassVisibilityToDom(val: number) {
  const clamped = Math.max(-150, Math.min(150, Math.round(val)));
  const t = (clamped + 150) / 300;
  // Keeps wallpaper clarity crisp at lower values while letting users frost more up to +150%
  const surfaceAlpha = (0.12 + t * 0.78).toFixed(3);
  const altAlpha = (0.08 + t * 0.68).toFixed(3);
  const blurPx = `${Math.round(1 + t * 14)}px`;
  document.documentElement.style.setProperty('--glass-surface-alpha', surfaceAlpha);
  document.documentElement.style.setProperty('--glass-alt-alpha', altAlpha);
  document.documentElement.style.setProperty('--glass-blur', blurPx);
}

/** Reader & Viewer Accessibility preferences (saved on device). */
export function loadAccessibilityPrefs(): AccessibilityPrefs {
  try {
    const raw = localStorage.getItem(A11Y_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        fontScale: [90, 100, 115, 130].includes(Number(parsed.fontScale)) ? Number(parsed.fontScale) : 100,
        readerMode: Boolean(parsed.readerMode),
        highContrast: Boolean(parsed.highContrast),
      };
    }
  } catch { /* ignore */ }
  return { fontScale: 100, readerMode: false, highContrast: false };
}

export function saveAccessibilityPrefs(prefs: AccessibilityPrefs) {
  localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
  applyAccessibilityToDom(prefs);
}

export function applyAccessibilityToDom(prefs: AccessibilityPrefs) {
  document.documentElement.style.fontSize = `${prefs.fontScale}%`;
  if (prefs.readerMode) document.documentElement.setAttribute('data-reader-mode', 'true');
  else document.documentElement.removeAttribute('data-reader-mode');
  if (prefs.highContrast) document.documentElement.setAttribute('data-high-contrast', 'true');
  else document.documentElement.removeAttribute('data-high-contrast');
}

/** Resize & compress a user-selected local image file so it fits comfortably in browser localStorage (never uploaded to server). */
export function compressImageFileToDataUrl(file: File, maxWidth = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
