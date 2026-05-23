import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  theme: "dark" | "light";
  language: "en" | "es";
  shortcuts: Record<string, string>;
  cursorDataUrl: string | null;
}

const STORAGE_KEY = "penciless-settings";

const DEFAULTS: AppSettings = {
  theme: "dark",
  language: "en",
  shortcuts: { pen: "alt+1", brush: "alt+2", eraser: "alt+3", shapes: "alt+4", colorPicker: "alt+5" },
  cursorDataUrl: null,
};

const STRINGS: Record<string, Record<string, string>> = {
  en: {
    title:           "Settings",
    sAppearance:     "Appearance",
    sTheme:          "Theme",
    sDark:           "Dark",
    sLight:          "Light",
    sLanguage:       "Language",
    sShortcuts:      "Keyboard shortcuts",
    sPen:            "Pen",
    sBrush:          "Brush",
    sEraser:         "Eraser",
    sShapes:         "Shapes",
    sColor:          "Color",
    sUndo:           "Undo",
    sRedo:           "Redo",
    sClear:          "Clear all",
    sToggle:         "Toggle overlay",
    sCursorSection:  "Custom cursor",
    sCursorDefault:  "Default",
    sCursorCustom:   "Custom",
    sCursorPick:     "Choose image",
    sCursorReset:    "Reset",
    sCursorHint:     "PNG recommended · resized to 32×32",
    sResetAll:       "Reset to defaults",
  },
  es: {
    title:           "Configuración",
    sAppearance:     "Apariencia",
    sTheme:          "Tema",
    sDark:           "Oscuro",
    sLight:          "Claro",
    sLanguage:       "Idioma",
    sShortcuts:      "Atajos de teclado",
    sPen:            "Pluma",
    sBrush:          "Pincel",
    sEraser:         "Borrador",
    sShapes:         "Formas",
    sColor:          "Color",
    sUndo:           "Deshacer",
    sRedo:           "Rehacer",
    sClear:          "Limpiar todo",
    sToggle:         "Activar/desactivar",
    sCursorSection:  "Puntero personalizado",
    sCursorDefault:  "Predeterminado",
    sCursorCustom:   "Personalizado",
    sCursorPick:     "Elegir imagen",
    sCursorReset:    "Restablecer",
    sCursorHint:     "PNG recomendado · se redimensionará a 32×32",
    sResetAll:       "Restablecer valores por defecto",
  },
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function save(s: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  emit("settings-changed", s);
}

let settings = load();

function applyLang(lang: "en" | "es") {
  const t = STRINGS[lang];
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n!;
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.documentElement.lang = lang;
  document.title = `penciless — ${t.title}`;
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll<HTMLButtonElement>("#theme-group button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
}

document.querySelectorAll<HTMLButtonElement>("#theme-group button").forEach(btn => {
  btn.addEventListener("click", () => {
    settings.theme = btn.dataset.theme as "dark" | "light";
    applyTheme(settings.theme);
    save(settings);
  });
});

function applyLangUI(lang: "en" | "es") {
  document.querySelectorAll<HTMLButtonElement>("#lang-group button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
  applyLang(lang);
}

document.querySelectorAll<HTMLButtonElement>("#lang-group button").forEach(btn => {
  btn.addEventListener("click", () => {
    settings.language = btn.dataset.lang as "en" | "es";
    applyLangUI(settings.language);
    save(settings);
  });
});

let recordingRow: HTMLElement | null = null;

function formatShortcut(s: string): string {
  return s.split("+").map(p => {
    if (p === "alt")   return "Alt";
    if (p === "ctrl")  return "Ctrl";
    if (p === "shift") return "Shift";
    return p.toUpperCase();
  }).join("+");
}

function stopRecording() {
  if (!recordingRow) return;
  const action = recordingRow.dataset.action!;
  const btn = recordingRow.querySelector<HTMLButtonElement>(".key-cap")!;
  btn.classList.remove("recording");
  btn.textContent = formatShortcut(settings.shortcuts[action] || "?");
  recordingRow = null;
  document.removeEventListener("keydown", captureKey, true);
}

function captureKey(e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (!recordingRow) return;

  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
  if (e.key === "Escape") { stopRecording(); return; }

  const action = recordingRow.dataset.action!;
  const parts: string[] = [];
  if (e.altKey)   parts.push("alt");
  if (e.ctrlKey)  parts.push("ctrl");
  if (e.shiftKey) parts.push("shift");
  parts.push(e.key.toLowerCase());
  const combo = parts.join("+");

  const conflict = Object.entries(settings.shortcuts).find(
    ([k, v]) => k !== action && v === combo
  );

  settings.shortcuts[action] = combo;
  save(settings);

  const btn = recordingRow.querySelector<HTMLButtonElement>(".key-cap")!;
  btn.classList.remove("recording");
  btn.textContent = formatShortcut(combo);
  btn.classList.toggle("conflict", !!conflict);
  recordingRow = null;
  document.removeEventListener("keydown", captureKey, true);
}

document.querySelectorAll<HTMLElement>(".sc-row[data-action]").forEach(row => {
  const action = row.dataset.action!;
  const btn = row.querySelector<HTMLButtonElement>(".key-cap")!;
  btn.textContent = formatShortcut(settings.shortcuts[action] || "?");

  btn.addEventListener("click", () => {
    if (recordingRow === row) { stopRecording(); return; }
    if (recordingRow) stopRecording();
    recordingRow = row;
    btn.classList.add("recording");
    btn.textContent = "···";
    document.addEventListener("keydown", captureKey, true);
  });
});

const cursorFile  = document.getElementById("cursor-file")  as HTMLInputElement;
const btnPick     = document.getElementById("btn-cursor-pick")!;
const btnReset    = document.getElementById("btn-cursor-reset") as HTMLButtonElement;
const cursorLabel = document.getElementById("cursor-label")!;
const cursorPrev  = document.getElementById("cursor-preview")!;

btnPick.addEventListener("click", () => cursorFile.click());

cursorFile.addEventListener("change", () => {
  const file = cursorFile.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      canvas.getContext("2d")!.drawImage(img, 0, 0, 32, 32);
      settings.cursorDataUrl = canvas.toDataURL("image/png");
      save(settings);
      updateCursorUI();
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
  cursorFile.value = "";
});

btnReset.addEventListener("click", () => {
  settings.cursorDataUrl = null;
  save(settings);
  updateCursorUI();
});

function updateCursorUI() {
  const lang = settings.language;
  const t = STRINGS[lang];
  const hasCustom = !!settings.cursorDataUrl;
  btnReset.disabled = !hasCustom;
  cursorLabel.textContent = hasCustom ? t.sCursorCustom : t.sCursorDefault;
  cursorPrev.style.backgroundImage = hasCustom ? `url(${settings.cursorDataUrl})` : "";
}


document.getElementById("btn-kofi")!.addEventListener("click", () => {
  invoke("open_url", { url: "https://ko-fi.com/joshiny" });
});

document.getElementById("btn-reset-all")!.addEventListener("click", () => {
  settings = { ...DEFAULTS, shortcuts: { ...DEFAULTS.shortcuts } };
  save(settings);
  applyTheme(settings.theme);
  applyLangUI(settings.language);
  updateCursorUI();
  document.querySelectorAll<HTMLElement>(".sc-row[data-action]").forEach(row => {
    const action = row.dataset.action!;
    const btn = row.querySelector<HTMLButtonElement>(".key-cap")!;
    btn.textContent = formatShortcut(settings.shortcuts[action] || "?");
    btn.classList.remove("conflict");
  });
});

applyTheme(settings.theme);
applyLangUI(settings.language);
updateCursorUI();
