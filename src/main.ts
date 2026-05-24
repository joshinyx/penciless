import { listen } from "@tauri-apps/api/event";
import { getStroke } from "perfect-freehand";
import { animate } from "motion";
import type { AppSettings } from "./settings";

type DrawTool = "pen" | "brush" | "eraser";
type ShapeType = "rect" | "circle" | "diamond" | "triangle" | "hexagon" | "star";
type Tool = DrawTool | "shape";

const TOOLTIP_STRINGS: Record<string, Record<string, string>> = {
  en: {
    dragHandle:    "Drag to move · Right-click to rotate",
    pen:           "Pen (P)",
    brush:         "Brush (B)",
    eraser:        "Eraser (E)",
    shapes:        "Shapes (S)",
    shapeRect:     "Rectangle",
    shapeCircle:   "Circle",
    shapeDiamond:  "Diamond",
    shapeTriangle: "Triangle",
    shapeHexagon:  "Hexagon",
    shapeStar:     "Star",
    color:         "Color (C)",
    clear:         "Clear all (Delete)",
  },
  es: {
    dragHandle:    "Arrastra para mover · Clic derecho para rotar",
    pen:           "Pluma (P)",
    brush:         "Pincel (B)",
    eraser:        "Borrador (E)",
    shapes:        "Formas (S)",
    shapeRect:     "Rectángulo",
    shapeCircle:   "Círculo",
    shapeDiamond:  "Rombo",
    shapeTriangle: "Triángulo",
    shapeHexagon:  "Hexágono",
    shapeStar:     "Estrella",
    color:         "Color (C)",
    clear:         "Limpiar todo (Delete)",
  },
};

function applyTooltips(lang: string) {
  const t = TOOLTIP_STRINGS[lang] ?? TOOLTIP_STRINGS.en;
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach(el => {
    const key = el.dataset.i18nTitle!;
    if (t[key]) el.title = t[key];
  });
}

const SHAPE_SVG: Record<ShapeType, { outline: string; fill: string }> = {
  rect:     { outline: `<path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200Z"/>`, fill: `<path d="M232,56V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56Z"/>` },
  circle:   { outline: `<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"/>`, fill: `<path d="M232,128A104,104,0,1,1,128,24,104.13,104.13,0,0,1,232,128Z"/>` },
  diamond:  { outline: `<path d="M235.33,116.72,139.28,20.66a16,16,0,0,0-22.56,0l-96,96.06a16,16,0,0,0,0,22.56l96.05,96.06h0a16,16,0,0,0,22.56,0l96.05-96.06a16,16,0,0,0,0-22.56ZM128,224h0L32,128,128,32,224,128Z"/>`, fill: `<path d="M240,128a15.85,15.85,0,0,1-4.67,11.28l-96.05,96.06a16,16,0,0,1-22.56,0h0l-96-96.06a16,16,0,0,1,0-22.56l96.05-96.06a16,16,0,0,1,22.56,0l96.05,96.06A15.85,15.85,0,0,1,240,128Z"/>` },
  triangle: { outline: `<path d="M236.8,188.09,149.35,36.22a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.34,24.34,0,0,0,40.55,224h174.9a24.34,24.34,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8Z"/>`, fill: `<path d="M236.78,211.81A24.34,24.34,0,0,1,215.45,224H40.55a24.34,24.34,0,0,1-21.33-12.19,23.51,23.51,0,0,1,0-23.72L106.65,36.22a24.76,24.76,0,0,1,42.7,0L236.8,188.09A23.51,23.51,0,0,1,236.78,211.81Z"/>` },
  hexagon:  { outline: `<path d="M223.68,66.15,135.68,18h0a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM216,175.82,128,224,40,175.82V80.18L128,32h0l88,48.17Z"/>`, fill: `<path d="M232,80.18v95.64a16,16,0,0,1-8.32,14l-88,48.17a15.88,15.88,0,0,1-15.36,0l-88-48.17a16,16,0,0,1-8.32-14V80.18a16,16,0,0,1,8.32-14l88-48.17a15.88,15.88,0,0,1,15.36,0l88,48.17A16,16,0,0,1,232,80.18Z"/>` },
  star:     { outline: `<path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65a8,8,0,0,0-8.38,0L69.09,215.94c-.15.09-.19.12-.38,0a.37.37,0,0,1-.17-.48l14.88-62.8a8,8,0,0,0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16A8,8,0,0,0,103,91.86l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153,91.86a8,8,0,0,0,6.75,4.92l63.92,5.16c.15,0,.24,0,.33.29S224,102.63,223.84,102.73Z"/>`, fill: `<path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z"/>` },
};

let currentTool: Tool = "pen";
let currentShape: ShapeType = "rect";
let currentColor = "#ef4444";
let drawSize   = 4;
let eraserSize = 12;

let isDrawing = false;
let startX = 0, startY = 0, lastX = 0, lastY = 0;
let points: [number, number, number][] = [];
let customCursor = "crosshair";
let defaultCursor = "crosshair";

{
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    c.getContext("2d")!.drawImage(img, 0, 0, 16, 16);
    defaultCursor = `url("${c.toDataURL()}") 0 15, crosshair`;
    const s = loadSettings();
    if (!s.cursorDataUrl) {
      customCursor = defaultCursor;
      enforceCursor();
    }
  };
  img.src = "/penciless-cursor.png";
}

let recentColors: string[] = [];

const STORAGE_KEY = "penciless-settings";
const DEFAULT_SHORTCUTS = { pen: "alt+1", brush: "alt+2", eraser: "alt+3", shapes: "alt+4", colorPicker: "alt+5" };
let shortcuts = { ...DEFAULT_SHORTCUTS };

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { theme: "dark", language: "en", shortcuts: { ...DEFAULT_SHORTCUTS }, cursorDataUrl: null, ...JSON.parse(raw) };
  } catch {}
  return { theme: "dark", language: "en", shortcuts: { ...DEFAULT_SHORTCUTS }, cursorDataUrl: null };
}

let isVertical = false;
let toolbarDragging = false;
let dragOffX = 0, dragOffY = 0;
let toolbarX = 0, toolbarY = 0;
let toolbarPositioned = false;

const canvasBg = document.getElementById("canvas-bg") as HTMLCanvasElement;
const canvasFg = document.getElementById("canvas-fg") as HTMLCanvasElement;
const ctxBg = canvasBg.getContext("2d")!;
const ctxFg = canvasFg.getContext("2d")!;

function resizeCanvases() {
  const tmp = new OffscreenCanvas(Math.max(1, canvasBg.width), Math.max(1, canvasBg.height));
  tmp.getContext("2d")!.drawImage(canvasBg, 0, 0);
  canvasBg.width = canvasFg.width = window.innerWidth;
  canvasBg.height = canvasFg.height = window.innerHeight;
  ctxBg.drawImage(tmp, 0, 0);
}
window.addEventListener("resize", () => {
  resizeCanvases();
  if (toolbarPositioned) clampAndApplyToolbar();
});
resizeCanvases();

function enforceCursor() {
  canvasBg.style.cursor = customCursor;
  document.documentElement.style.cursor = customCursor;
}

function applySettings(s: AppSettings) {
  document.documentElement.setAttribute("data-theme", s.theme);
  shortcuts = { ...DEFAULT_SHORTCUTS, ...s.shortcuts };
  customCursor = s.cursorDataUrl
    ? `url("${s.cursorDataUrl}") 16 16, crosshair`
    : defaultCursor;
  enforceCursor();
  applyTooltips(s.language);
}

const initialSettings = loadSettings();
applySettings(initialSettings);

listen<AppSettings>("settings-changed", (e) => applySettings(e.payload));

const undoStack: ImageBitmap[] = [];
const redoStack: ImageBitmap[] = [];
const MAX_HISTORY = 10;

function captureSnapshot(): ImageBitmap {
  const oc = new OffscreenCanvas(canvasBg.width, canvasBg.height);
  oc.getContext("2d")!.drawImage(canvasBg, 0, 0);
  return oc.transferToImageBitmap();
}

function saveSnapshot() {
  undoStack.push(captureSnapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift()!.close();
  redoStack.forEach(b => b.close());
  redoStack.length = 0;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(captureSnapshot());
  const snap = undoStack.pop()!;
  ctxBg.clearRect(0, 0, canvasBg.width, canvasBg.height);
  ctxBg.drawImage(snap, 0, 0);
  snap.close();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(captureSnapshot());
  const snap = redoStack.pop()!;
  ctxBg.clearRect(0, 0, canvasBg.width, canvasBg.height);
  ctxBg.drawImage(snap, 0, 0);
  snap.close();
}

function freehandOptions(tool: DrawTool) {
  return {
    size:             tool === "brush" ? drawSize * 3.5 : drawSize,
    thinning:         tool === "brush" ? 0    : 0.4,
    smoothing:        tool === "brush" ? 0.7  : 0.5,
    streamline:       tool === "brush" ? 0.4  : 0.45,
    simulatePressure: tool !== "brush",
    easing:           (t: number) => Math.sin((t * Math.PI) / 2),
    last: true,
  };
}

function toPath2D(stroke: number[][]): Path2D {
  const p = new Path2D();
  if (!stroke.length) return p;
  p.moveTo(stroke[0][0], stroke[0][1]);
  for (let i = 1; i < stroke.length; i++) p.lineTo(stroke[i][0], stroke[i][1]);
  p.closePath();
  return p;
}

function renderFreehand(ctx: CanvasRenderingContext2D, tool: DrawTool) {
  if (!points.length) return;
  if (tool === "brush") {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth   = drawSize * 3.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
  } else {
    const path = toPath2D(getStroke(points, freehandOptions(tool)));
    ctx.fillStyle = currentColor;
    ctx.fill(path);
  }
}

function squareConstrain(x1: number, y1: number, x2: number, y2: number): [number, number] {
  const dx = x2 - x1, dy = y2 - y1;
  const size = Math.min(Math.abs(dx), Math.abs(dy));
  return [x1 + Math.sign(dx) * size, y1 + Math.sign(dy) * size];
}

function renderShape(ctx: CanvasRenderingContext2D, shape: ShapeType, x1: number, y1: number, x2: number, y2: number) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
  const r  = Math.min(rx, ry);

  ctx.beginPath();
  ctx.strokeStyle = currentColor;
  ctx.lineWidth   = Math.max(1.5, drawSize);
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  switch (shape) {
    case "rect":
      ctx.rect(minX, minY, maxX - minX, maxY - minY);
      break;
    case "circle":
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      break;
    case "diamond":
      ctx.moveTo(cx, minY);
      ctx.lineTo(maxX, cy);
      ctx.lineTo(cx, maxY);
      ctx.lineTo(minX, cy);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(cx, minY);
      ctx.lineTo(maxX, maxY);
      ctx.lineTo(minX, maxY);
      ctx.closePath();
      break;
    case "hexagon":
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const a   = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.4;
        const x   = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
  }

  ctx.stroke();
}

canvasBg.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  saveSnapshot();
  canvasBg.setPointerCapture(e.pointerId);
  isDrawing = true;
  startX = lastX = e.clientX;
  startY = lastY = e.clientY;
  points = [[e.clientX, e.clientY, e.pressure || 0.5]];
  shapeMenu.hidden = true;

  if (currentTool === "eraser") {
    ctxBg.save();
    ctxBg.globalCompositeOperation = "destination-out";
    ctxBg.beginPath();
    ctxBg.arc(e.clientX, e.clientY, eraserSize, 0, Math.PI * 2);
    ctxBg.fillStyle = "rgba(0,0,0,1)";
    ctxBg.fill();
    ctxBg.restore();
  }
});

let lastEraserX = 0, lastEraserY = 0;

function drawEraserCursor(x: number, y: number) {
  lastEraserX = x; lastEraserY = y;
  ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
  ctxFg.save();
  ctxFg.globalAlpha = 0.1;
  ctxFg.beginPath();
  ctxFg.arc(x, y, eraserSize, 0, Math.PI * 2);
  ctxFg.fillStyle = "#ffffff";
  ctxFg.fill();
  ctxFg.globalAlpha = 0.35;
  ctxFg.strokeStyle = "#ffffff";
  ctxFg.lineWidth = 1;
  ctxFg.stroke();
  ctxFg.restore();
}

canvasBg.addEventListener("pointermove", (e) => {
  if (currentTool === "eraser") drawEraserCursor(e.clientX, e.clientY);
  if (!isDrawing) return;

  if (currentTool === "shape" && e.shiftKey) {
    [lastX, lastY] = squareConstrain(startX, startY, e.clientX, e.clientY);
  } else {
    lastX = e.clientX;
    lastY = e.clientY;
  }

  if (currentTool === "eraser") {
    ctxBg.save();
    ctxBg.globalCompositeOperation = "destination-out";
    ctxBg.beginPath();
    ctxBg.moveTo(points[points.length - 1][0], points[points.length - 1][1]);
    ctxBg.lineTo(e.clientX, e.clientY);
    ctxBg.strokeStyle = "rgba(0,0,0,1)";
    ctxBg.lineWidth = eraserSize * 2;
    ctxBg.lineCap = "round";
    ctxBg.stroke();
    ctxBg.restore();
    points.push([e.clientX, e.clientY, 0]);
    return;
  }

  points.push([e.clientX, e.clientY, e.pressure || 0.5]);

  ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);

  if (currentTool === "pen" || currentTool === "brush") {
    renderFreehand(ctxFg, currentTool);
  } else if (currentTool === "shape") {
    renderShape(ctxFg, currentShape, startX, startY, lastX, lastY);
  }
});

canvasBg.addEventListener("pointerup", () => {
  if (!isDrawing) return;
  isDrawing = false;

  if (currentTool === "pen" || currentTool === "brush") {
    renderFreehand(ctxBg, currentTool);
  } else if (currentTool === "shape") {
    renderShape(ctxBg, currentShape, startX, startY, lastX, lastY);
  }

  if (currentTool === "eraser") {
    drawEraserCursor(lastEraserX, lastEraserY);
  } else {
    ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
  }
  points = [];
});

canvasBg.addEventListener("pointercancel", () => {
  isDrawing = false;
  ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
  points = [];
});

canvasBg.addEventListener("pointerleave", () => {
  if (currentTool === "eraser") ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
});

document.addEventListener("contextmenu", (e) => { e.preventDefault(); });

const toolbar = document.getElementById("toolbar")!;
let isPassthrough = false;

listen<boolean>("alt-state", (event) => {
  isPassthrough = event.payload;
  toolbar.classList.toggle("passthrough", isPassthrough);
  if (isPassthrough) closeColorPopup();
  else enforceCursor();
});

window.addEventListener("focus", enforceCursor);
document.addEventListener("keydown", (e) => {
  if (e.key === "Alt") { e.preventDefault(); enforceCursor(); }
});
document.addEventListener("keyup", (e) => {
  if (e.key === "Alt") enforceCursor();
});
document.addEventListener("pointermove", enforceCursor);

listen("toggle-annotating", () => {});

function matchShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split("+");
  const key   = parts[parts.length - 1];
  return e.key.toLowerCase() === key
    && e.altKey   === parts.includes("alt")
    && e.ctrlKey  === parts.includes("ctrl")
    && e.shiftKey === parts.includes("shift");
}

window.addEventListener("keydown", (e) => {
  if (isPassthrough) return;
  if ((document.activeElement as HTMLElement)?.tagName === "INPUT") return;

  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); redo(); return; }
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
  if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }

  if (e.key === "Delete" || e.key === "Backspace") {
    ctxBg.clearRect(0, 0, canvasBg.width, canvasBg.height);
    ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
  }
  if (matchShortcut(e, shortcuts.pen))         selectTool("pen");
  if (matchShortcut(e, shortcuts.brush))        selectTool("brush");
  if (matchShortcut(e, shortcuts.eraser))       selectTool("eraser");
  if (matchShortcut(e, shortcuts.colorPicker)) {
    colorPopup.hasAttribute("hidden") ? openColorPopup() : closeColorPopup();
  }
  if (matchShortcut(e, shortcuts.shapes)) {
    if (currentTool !== "shape") {
      selectTool("shape");
    } else {
      const order: ShapeType[] = ["rect", "circle", "diamond", "triangle", "hexagon", "star"];
      currentShape = order[(order.indexOf(currentShape) + 1) % order.length];
      updateShapeIcon(currentShape);
      document.querySelectorAll<HTMLElement>(".shape-opt").forEach(b =>
        b.classList.toggle("active", b.dataset.shape === currentShape)
      );
    }
    shapeMenu.hidden = true;
  }
});

const dragHandle = document.getElementById("drag-handle")!;

function clampAndApplyToolbar() {
  toolbarX = Math.max(0, Math.min(window.innerWidth  - toolbar.offsetWidth,  toolbarX));
  toolbarY = Math.max(0, Math.min(window.innerHeight - toolbar.offsetHeight, toolbarY));
  toolbar.style.left      = toolbarX + "px";
  toolbar.style.top       = toolbarY + "px";
  toolbar.style.bottom    = "auto";
  toolbar.style.transform = "none";
}

requestAnimationFrame(() => {
  const rect = toolbar.getBoundingClientRect();
  toolbarX = rect.left;
  toolbarY = rect.top;
  clampAndApplyToolbar();
  toolbarPositioned = true;
});

dragHandle.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  toolbarDragging = true;
  dragOffX = e.clientX - toolbarX;
  dragOffY = e.clientY - toolbarY;
  e.preventDefault();
});

dragHandle.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  isVertical = !isVertical;
  toolbar.classList.toggle("vertical", isVertical);
  requestAnimationFrame(() => { clampAndApplyToolbar(); });
});

window.addEventListener("mousemove", (e) => {
  if (!toolbarDragging) return;
  toolbarX = e.clientX - dragOffX;
  toolbarY = e.clientY - dragOffY;
  clampAndApplyToolbar();
});

window.addEventListener("mouseup", () => { toolbarDragging = false; });

function selectTool(tool: Tool) {
  const wasEraser = currentTool === "eraser";
  currentTool = tool;
  syncSizeUI();
  document.querySelectorAll<HTMLElement>(".tool[data-tool]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });
  if (tool !== "shape") shapeMenu.hidden = true;
  if (wasEraser && tool !== "eraser") {
    ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
  }
}

document.querySelectorAll<HTMLButtonElement>(".tool[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool as Tool;
    shapeMenu.hidden = true;
    selectTool(tool);
    document.querySelectorAll<HTMLElement>(".tool[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === tool);
    });
    animate(btn as Element, { scale: [0.82, 1] } as any, { duration: 0.22, ease: [0.34, 1.56, 0.64, 1] });
  });
});

const shapeMenu = document.getElementById("shape-menu")!;
const shapeIconOutline = document.getElementById("shape-icon-outline")!;
const shapeIconFill    = document.getElementById("shape-icon-fill")!;

function updateShapeIcon(shape: ShapeType) {
  shapeIconOutline.innerHTML = SHAPE_SVG[shape].outline;
  shapeIconFill.innerHTML    = SHAPE_SVG[shape].fill;
}
const shapeBtn  = document.getElementById("shape-btn")!;

document.querySelectorAll<HTMLButtonElement>(".shape-opt").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentShape = btn.dataset.shape as ShapeType;
    shapeMenu.hidden = true;
    updateShapeIcon(currentShape);
    document.querySelectorAll(".shape-opt").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

shapeBtn.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (currentTool !== "shape") selectTool("shape");
  shapeMenu.hidden = !shapeMenu.hidden;
});

document.addEventListener("mousedown", (e) => {
  if (!shapeMenu.hidden && !(e.target as Element).closest(".shape-wrapper")) {
    shapeMenu.hidden = true;
  }
}, true);

const colorSwatch    = document.getElementById("color-swatch")!;
const colorPickerBtn = document.getElementById("color-picker-btn")!;
const colorPopup     = document.getElementById("color-popup")!;
const svCanvas       = document.getElementById("sv-canvas")  as HTMLCanvasElement;
const svThumb        = document.getElementById("sv-thumb")!;
const hueCanvas      = document.getElementById("hue-canvas") as HTMLCanvasElement;
const hueThumb       = document.getElementById("hue-thumb")!;
const popupHex       = document.getElementById("popup-hex")  as HTMLInputElement;
const popupRecent    = document.getElementById("popup-recent")!;

let pickerH = 0, pickerS = 1, pickerV = 1;
let isDraggingSV = false, isDraggingHue = false;

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if      (max === r) h = (((g - b) / d) + 6) % 6 * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else                h = ((r - g) / d + 4) * 60;
  }
  return [h, max > 0 ? d / max : 0, max];
}

function drawSV() {
  const ctx = svCanvas.getContext("2d")!;
  const w = svCanvas.width, h = svCanvas.height;
  ctx.fillStyle = hsvToHex(pickerH, 1, 1);
  ctx.fillRect(0, 0, w, h);
  const satGrad = ctx.createLinearGradient(0, 0, w, 0);
  satGrad.addColorStop(0, "rgba(255,255,255,1)");
  satGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = satGrad;
  ctx.fillRect(0, 0, w, h);
  const valGrad = ctx.createLinearGradient(0, 0, 0, h);
  valGrad.addColorStop(0, "rgba(0,0,0,0)");
  valGrad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = valGrad;
  ctx.fillRect(0, 0, w, h);
}

function drawHue() {
  const ctx = hueCanvas.getContext("2d")!;
  const w = hueCanvas.width, h = hueCanvas.height;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function updateThumbs() {
  svThumb.style.left = `${pickerS * svCanvas.width}px`;
  svThumb.style.top  = `${(1 - pickerV) * svCanvas.height}px`;
  hueThumb.style.left = `${(pickerH / 360) * hueCanvas.width}px`;
}

function applyPickerColor(addToRecent = true) {
  currentColor = hsvToHex(pickerH, pickerS, pickerV);
  colorSwatch.style.background = currentColor;
  popupHex.value = currentColor.slice(1).toUpperCase();
  popupHex.classList.remove("invalid");
  if (addToRecent) pushRecentColor(currentColor);
  animate(colorSwatch as Element, { scale: [0.82, 1] } as any, { duration: 0.25, ease: [0.34, 1.56, 0.64, 1] });
}

function pickSV(e: PointerEvent) {
  const rect = svCanvas.getBoundingClientRect();
  pickerS = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  pickerV = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
  updateThumbs();
  applyPickerColor(false);
}

function pickHue(e: PointerEvent) {
  const rect = hueCanvas.getBoundingClientRect();
  pickerH = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
  drawSV();
  updateThumbs();
  applyPickerColor(false);
}

svCanvas.addEventListener("pointerdown", (e) => {
  isDraggingSV = true;
  svCanvas.setPointerCapture(e.pointerId);
  pickSV(e);
});
svCanvas.addEventListener("pointermove", (e) => { if (isDraggingSV) pickSV(e); });
svCanvas.addEventListener("pointerup", () => {
  if (isDraggingSV) { isDraggingSV = false; pushRecentColor(currentColor); }
});

hueCanvas.addEventListener("pointerdown", (e) => {
  isDraggingHue = true;
  hueCanvas.setPointerCapture(e.pointerId);
  pickHue(e);
});
hueCanvas.addEventListener("pointermove", (e) => { if (isDraggingHue) pickHue(e); });
hueCanvas.addEventListener("pointerup", () => {
  if (isDraggingHue) { isDraggingHue = false; pushRecentColor(currentColor); }
});

function openColorPopup() {
  popupHex.value = currentColor.slice(1).toUpperCase();
  colorPopup.removeAttribute("hidden");
  drawSV();
  drawHue();
  updateThumbs();
  const btnRect = colorPickerBtn.getBoundingClientRect();
  const popW    = colorPopup.getBoundingClientRect().width;
  const popH    = colorPopup.getBoundingClientRect().height;
  let left = btnRect.left + btnRect.width / 2 - popW / 2;
  let top  = btnRect.top - popH - 10;
  if (top < 8) top = btnRect.bottom + 10;
  left = Math.max(8, Math.min(window.innerWidth  - popW - 8, left));
  top  = Math.max(8, Math.min(window.innerHeight - popH - 8, top));
  colorPopup.style.left = left + "px";
  colorPopup.style.top  = top  + "px";
}

function closeColorPopup() {
  colorPopup.setAttribute("hidden", "");
}

colorPickerBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  colorPopup.hasAttribute("hidden") ? openColorPopup() : closeColorPopup();
});

document.addEventListener("mousedown", (e) => {
  if (!colorPopup.hasAttribute("hidden") &&
      !(e.target as Element).closest("#color-popup") &&
      !(e.target as Element).closest("#color-picker-btn")) {
    closeColorPopup();
  }
}, true);

popupHex.addEventListener("focus",   () => popupHex.select());
popupHex.addEventListener("keydown", (e) => e.stopPropagation());

popupHex.addEventListener("input", () => {
  let val = popupHex.value.trim();
  if (!val.startsWith("#")) val = "#" + val;
  if (/^#[0-9a-fA-F]{3}$/.test(val))
    val = "#" + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    popupHex.classList.remove("invalid");
    [pickerH, pickerS, pickerV] = hexToHsv(val);
    currentColor = val;
    colorSwatch.style.background = val;
    drawSV();
    updateThumbs();
    pushRecentColor(val);
  } else {
    popupHex.classList.add("invalid");
  }
});

popupHex.addEventListener("blur", () => {
  if (popupHex.classList.contains("invalid")) {
    popupHex.value = currentColor.slice(1).toUpperCase();
    popupHex.classList.remove("invalid");
  }
});

function pushRecentColor(hex: string) {
  const normalized = hex.toUpperCase();
  const idx = recentColors.indexOf(normalized);
  if (idx !== -1) recentColors.splice(idx, 1);
  recentColors.unshift(normalized);
  if (recentColors.length > 9) recentColors.pop();
  renderRecentColors();
}

function renderRecentColors() {
  popupRecent.innerHTML = "";
  recentColors.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "pop-swatch";
    btn.style.background = c;
    btn.title = c;
    btn.addEventListener("click", () => {
      [pickerH, pickerS, pickerV] = hexToHsv(c);
      currentColor = c;
      colorSwatch.style.background = c;
      popupHex.value = c.slice(1).toUpperCase();
      drawSV();
      updateThumbs();
      animate(colorSwatch as Element, { scale: [0.82, 1] } as any, { duration: 0.25, ease: [0.34, 1.56, 0.64, 1] });
    });
    popupRecent.appendChild(btn);
  });
}

currentColor = "#ef4444";
[pickerH, pickerS, pickerV] = hexToHsv(currentColor);
colorSwatch.style.background = currentColor;

const sizeSlider = document.getElementById("size-slider") as HTMLInputElement;
const sizeValue  = document.getElementById("size-value")  as HTMLInputElement;

function clampSize(n: number): number {
  return Math.max(1, Math.min(50, isNaN(n) ? 1 : n));
}

function getSize()       { return currentTool === "eraser" ? eraserSize : drawSize; }
function setSize(n: number) {
  if (currentTool === "eraser") eraserSize = n; else drawSize = n;
}

function syncSizeUI() {
  const s = getSize();
  sizeSlider.value = String(s);
  sizeValue.value  = String(s);
}

sizeSlider.addEventListener("input", () => {
  setSize(Number(sizeSlider.value));
  sizeValue.value = String(getSize());
});

sizeValue.addEventListener("focus", () => sizeValue.select());
sizeValue.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") sizeValue.blur();
});
sizeValue.addEventListener("input", () => {
  sizeValue.value = sizeValue.value.replace(/\D/g, "");
});
sizeValue.addEventListener("blur", () => {
  setSize(clampSize(parseInt(sizeValue.value, 10)));
  syncSizeUI();
});

window.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1 : -1;
  setSize(clampSize(getSize() + delta));
  syncSizeUI();
  if (currentTool === "eraser") drawEraserCursor(lastEraserX, lastEraserY);
}, { passive: false });

document.getElementById("btn-clear")!.addEventListener("click", () => {
  saveSnapshot();
  ctxBg.clearRect(0, 0, canvasBg.width, canvasBg.height);
  ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
  animate(document.getElementById("btn-clear")! as Element, { rotate: [0, 15, 0] } as any, { duration: 0.3, ease: "easeOut" });
});
