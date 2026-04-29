import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BringToFront,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  Eraser,
  Hand,
  ImagePlus,
  Minus,
  MousePointer2,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  SendToBack,
  Square,
  TextCursor,
  Trash2,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCollaboration } from "@/hooks/use-collaboration";

export type Tool =
  | "select"
  | "hand"
  | "pen"
  | "rect"
  | "ellipse"
  | "text"
  | "eraser";

type Point = { x: number; y: number };

type Stroke = {
  id: string;
  tool: "pen" | "eraser";
  color: string;
  size: number;
  points: Point[];
};

type Shape = {
  id: string;
  kind: "rect" | "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
};

type TextItem = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

type ImageItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
};

export type BoardItem =
  | { type: "stroke"; data: Stroke }
  | { type: "shape"; data: Shape }
  | { type: "text"; data: TextItem }
  | { type: "image"; data: ImageItem };

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function toCanvasPoint(
  clientX: number,
  clientY: number,
  viewport: { x: number; y: number; zoom: number },
  canvasRect: DOMRect,
) {
  const vx = clientX - canvasRect.left;
  const vy = clientY - canvasRect.top;
  return {
    x: (vx - viewport.x) / viewport.zoom,
    y: (vy - viewport.y) / viewport.zoom,
  };
}

function hslToCss(hsl: string) {
  return `hsl(${hsl})`;
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type Bounds = { id: string; type: "image" | "shape"; x: number; y: number; w: number; h: number };

function itemBounds(item: BoardItem): Bounds | null {
  if (item.type === "image") {
    const i = item.data;
    return { id: i.id, type: "image", x: i.x, y: i.y, w: i.width, h: i.height };
  }
  if (item.type === "shape") {
    const s = item.data;
    return {
      id: s.id,
      type: "shape",
      x: Math.min(s.x, s.x + s.w),
      y: Math.min(s.y, s.y + s.h),
      w: Math.abs(s.w),
      h: Math.abs(s.h),
    };
  }
  return null;
}

function getHandleRects(b: { x: number; y: number; w: number; h: number }, hs: number) {
  const { x, y, w, h } = b;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return {
    nw: { x: x - hs / 2, y: y - hs / 2, w: hs, h: hs },
    n: { x: cx - hs / 2, y: y - hs / 2, w: hs, h: hs },
    ne: { x: x + w - hs / 2, y: y - hs / 2, w: hs, h: hs },
    e: { x: x + w - hs / 2, y: cy - hs / 2, w: hs, h: hs },
    se: { x: x + w - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    s: { x: cx - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    sw: { x: x - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    w: { x: x - hs / 2, y: cy - hs / 2, w: hs, h: hs },
  } as Record<Handle, { x: number; y: number; w: number; h: number }>;
}

function hitHandle(p: Point, b: { x: number; y: number; w: number; h: number }, zoom: number): Handle | null {
  const hs = 12 / zoom;
  const rects = getHandleRects(b, hs);
  for (const k of Object.keys(rects) as Handle[]) {
    const r = rects[k];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return k;
  }
  return null;
}

function hitBounds(p: Point, b: { x: number; y: number; w: number; h: number }) {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

const HANDLE_CURSOR_CLASS: Record<Handle, string> = {
  n: "cursor-ns-resize",
  s: "cursor-ns-resize",
  e: "cursor-ew-resize",
  w: "cursor-ew-resize",
  ne: "cursor-nesw-resize",
  sw: "cursor-nesw-resize",
  nw: "cursor-nwse-resize",
  se: "cursor-nwse-resize",
};

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function useInterval(callback: () => void, delay: number | null) {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => cbRef.current(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}

const PRESET_COLORS = [
  { name: "Slate", value: "#4A5568" },
  { name: "Blue", value: "#3175F1" },
  { name: "Purple", value: "#805AD5" },
  { name: "Green", value: "#30B170" },
  { name: "Black", value: "#111827" },
  { name: "Red", value: "#E53E3E" },
];

function ToolButton({
  active,
  label,
  icon,
  onClick,
  testId,
  shortcut,
}: {
  active?: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  testId: string;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          onClick={onClick}
          className={cn(
            "group relative grid size-10 place-items-center rounded-xl border bg-white/80 text-slate-700 shadow-sm backdrop-blur",
            "transition-all duration-200",
            "hover:-translate-y-0.5 hover:shadow-md",
            active
              ? "border-slate-200 bg-slate-900 text-white shadow-md"
              : "border-slate-200/70",
          )}
        >
          <span className={cn("transition-transform", active ? "" : "group-hover:scale-[1.04]")}>{icon}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="bg-slate-900 text-white">
        {label}
        {shortcut && (
          <span className="ml-2 opacity-70">
            <Kbd>{shortcut}</Kbd>
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ArrangeButton({
  label,
  icon,
  onClick,
  testId,
  shortcut,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  testId: string;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          onClick={onClick}
          className="grid size-9 place-items-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-slate-900 text-white">
        {label}
        {shortcut && (
          <span className="ml-2 opacity-70">
            <Kbd>{shortcut}</Kbd>
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ContextMenuItem({
  label,
  shortcut,
  onClick,
  danger,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-100",
      )}
    >
      <span>{label}</span>
      {shortcut && <span className="text-[11px] text-slate-400">{shortcut}</span>}
    </button>
  );
}

function ColorDot({
  value,
  active,
  onClick,
  testId,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "relative size-8 rounded-full border shadow-sm transition-transform",
        "hover:scale-[1.06] active:scale-[0.98]",
        active ? "border-slate-900" : "border-slate-200",
      )}
      style={{ backgroundColor: value }}
      aria-label={`Color ${value}`}
    >
      {active ? (
        <span className="absolute inset-0 rounded-full ring-2 ring-slate-900/20" />
      ) : null}
    </button>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border-0 p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            onChange(val);
          }
        }}
        placeholder="#000000"
        className="w-20 rounded border border-slate-200 px-2 py-1 text-xs font-mono uppercase"
      />
    </div>
  );
}

export default function WhiteboardPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  
  // Offscreen canvas for drawing content (strokes, shapes, etc.) - eraser affects this layer only
  const contentCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>("#3182CE");
  const [fill, setFill] = useState<string>("rgba(49,130,206,0.10)");
  const [customColor, setCustomColor] = useState<string>("#3182CE");
  const [strokeSize, setStrokeSize] = useState<number>(3);
  const [zoom, setZoom] = useState<number>(1);
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const [items, setItems] = useState<BoardItem[]>([]);
  const itemsRef = useRef<BoardItem[]>(items);
  
  // Keep ref in sync with state to avoid stale closures
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  
  const [past, setPast] = useState<BoardItem[][]>([]);
  const [future, setFuture] = useState<BoardItem[][]>([]);

  const commitHistory = useCallback(() => {
    setPast((p) => [...p, itemsRef.current]);
    setFuture([]);
  }, []);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [activeShape, setActiveShape] = useState<Shape | null>(null);
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<
    | { kind: "move"; startMouse: Point; startBounds: Bounds }
    | { kind: "resize"; handle: Handle; startMouse: Point; startBounds: Bounds }
    | null
  >(null);
  const [hoverHandle, setHoverHandle] = useState<Handle | null>(null);
  const [hoverItemId, setHoverItemId] = useState<string | null>(null);
  const dragPreSnapshotRef = useRef<BoardItem[] | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(
    null,
  );

  const updateItemBounds = useCallback(
    (id: string, b: { x: number; y: number; w: number; h: number }) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.type === "image" && it.data.id === id) {
            return { type: "image", data: { ...it.data, x: b.x, y: b.y, width: b.w, height: b.h } };
          }
          if (it.type === "shape" && it.data.id === id) {
            return { type: "shape", data: { ...it.data, x: b.x, y: b.y, w: b.w, h: b.h } };
          }
          return it;
        }),
      );
    },
    [],
  );

  const findBounds = useCallback(
    (id: string | null): Bounds | null => {
      if (!id) return null;
      const f = items.find(
        (it) =>
          (it.type === "image" && it.data.id === id) ||
          (it.type === "shape" && it.data.id === id),
      );
      return f ? itemBounds(f) : null;
    },
    [items],
  );

  const recolorSelected = useCallback(
    (stroke: string, fill: string) => {
      if (!selectedId) return;
      const target = itemsRef.current.find(
        (it) => it.type === "shape" && it.data.id === selectedId,
      );
      if (!target) return;
      commitHistory();
      setItems((prev) =>
        prev.map((it) =>
          it.type === "shape" && it.data.id === selectedId
            ? { type: "shape", data: { ...it.data, stroke, fill } }
            : it,
        ),
      );
    },
    [selectedId, commitHistory],
  );

  const reorderSelected = useCallback(
    (mode: "front" | "back" | "forward" | "backward") => {
      if (!selectedId) return;
      const prev = itemsRef.current;
      const idx = prev.findIndex(
        (it) =>
          (it.type === "image" || it.type === "shape") && it.data.id === selectedId,
      );
      if (idx === -1) return;
      let target = idx;
      if (mode === "front") target = prev.length - 1;
      else if (mode === "back") target = 0;
      else if (mode === "forward") target = Math.min(prev.length - 1, idx + 1);
      else target = Math.max(0, idx - 1);
      if (target === idx) return;
      commitHistory();
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      setItems(next);
    },
    [selectedId, commitHistory],
  );

  // Collaboration: handle remote operations
  const handleRemoteDraw = useCallback((item: BoardItem) => {
    setItems((prev) => [...prev, item]);
    setFuture([]);
  }, []);

  const handleRemoteClear = useCallback(() => {
    setItems([]);
    setPast([]);
    setFuture([]);
    setActiveShape(null);
    setActiveStroke(null);
  }, []);

  // Sync callbacks for collaboration
  const handleSyncRequest = useCallback((itemCount: number): BoardItem[] => {
    // Use ref to get current items and avoid stale closure
    const currentItems = itemsRef.current;
    console.log(`[Whiteboard] Sync request: peer has ${itemCount}, I have ${currentItems.length} items`);
    if (currentItems.length > itemCount) {
      console.log(`[Whiteboard] Sending ${currentItems.length} items to peer`);
      return currentItems;
    }
    console.log(`[Whiteboard] Not sending items (peer has equal or more)`);
    return [];
  }, []);

  const handleSyncReceive = useCallback((newItems: BoardItem[]) => {
    console.log(`[Whiteboard] Received sync with ${newItems.length} items`);
    // Merge received items with our current items (avoiding duplicates by ID)
    setItems(prev => {
      const existingIds = new Set(prev.map(item => 
        item.type === "stroke" ? item.data.id : 
        item.type === "shape" ? item.data.id : 
        item.data.id
      ));
      const uniqueNewItems = newItems.filter(item => {
        const id = item.type === "stroke" ? item.data.id : 
                   item.type === "shape" ? item.data.id : 
                   item.data.id;
        return !existingIds.has(id);
      });
      return [...prev, ...uniqueNewItems];
    });
    setFuture([]);
  }, []);

  const {
    myName,
    myColor,
    remotePeers,
    isConnected,
    peerCount,
    broadcastCursor,
    broadcastDraw,
    broadcastClear,
  } = useCollaboration(handleRemoteDraw, handleRemoteClear, handleSyncRequest, handleSyncReceive);

  const displayedZoomPct = useMemo(() => formatPct(zoom), [zoom]);

  useEffect(() => {
    setViewport((v) => ({ ...v, zoom }));
  }, [zoom]);

  // Fade inactive remote peers
  useInterval(() => {
    const now = Date.now();
    // Remote peers are already managed by the collaboration hook
    // This interval is kept for any additional cleanup if needed
  }, 1000);

  const draw = useMemo(() => {
    return () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));

      // Initialize or resize main canvas
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      // Initialize or resize content canvas (offscreen)
      let contentCanvas = contentCanvasRef.current;
      if (!contentCanvas) {
        contentCanvas = document.createElement("canvas");
        contentCanvasRef.current = contentCanvas;
      }
      if (contentCanvas.width !== Math.floor(w * dpr) || contentCanvas.height !== Math.floor(h * dpr)) {
        contentCanvas.width = Math.floor(w * dpr);
        contentCanvas.height = Math.floor(h * dpr);
      }

      const ctx = canvas.getContext("2d");
      const contentCtx = contentCanvas.getContext("2d");
      if (!ctx || !contentCtx) return;

      // ===== DRAW CONTENT LAYER (offscreen) =====
      contentCtx.save();
      contentCtx.scale(dpr, dpr);
      
      // Clear content canvas to transparent
      contentCtx.clearRect(0, 0, w, h);
      
      // Apply viewport transform for content
      contentCtx.translate(viewport.x, viewport.y);
      contentCtx.scale(viewport.zoom, viewport.zoom);

      const all: BoardItem[] = [...items];
      if (activeShape) all.push({ type: "shape", data: activeShape });
      // Include active stroke on content layer so eraser preview shows correctly
      if (activeStroke) all.push({ type: "stroke", data: activeStroke });

      for (const item of all) {
        if (item.type === "stroke") {
          const s = item.data;
          if (s.points.length < 2) continue;

          contentCtx.lineCap = "round";
          contentCtx.lineJoin = "round";
          contentCtx.lineWidth = s.size;
          
          if (s.tool === "eraser") {
            // Apply eraser effect on content layer only
            contentCtx.globalCompositeOperation = "destination-out";
            contentCtx.strokeStyle = "rgba(0,0,0,1)";
          } else {
            contentCtx.globalCompositeOperation = "source-over";
            contentCtx.strokeStyle = s.color;
          }

          contentCtx.beginPath();
          contentCtx.moveTo(s.points[0].x, s.points[0].y);
          for (let i = 1; i < s.points.length; i++) {
            const p = s.points[i];
            contentCtx.lineTo(p.x, p.y);
          }
          contentCtx.stroke();
          contentCtx.globalCompositeOperation = "source-over";
        }

        if (item.type === "shape") {
          const sh = item.data;
          contentCtx.globalCompositeOperation = "source-over";
          contentCtx.lineWidth = sh.strokeWidth;
          contentCtx.strokeStyle = sh.stroke;
          contentCtx.fillStyle = sh.fill;

          if (sh.kind === "rect") {
            contentCtx.beginPath();
            contentCtx.rect(sh.x, sh.y, sh.w, sh.h);
            contentCtx.fill();
            contentCtx.stroke();
          } else {
            const cx = sh.x + sh.w / 2;
            const cy = sh.y + sh.h / 2;
            const rx = Math.abs(sh.w / 2);
            const ry = Math.abs(sh.h / 2);
            contentCtx.beginPath();
            contentCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            contentCtx.fill();
            contentCtx.stroke();
          }
        }

        if (item.type === "text") {
          const t = item.data;
          contentCtx.globalCompositeOperation = "source-over";
          contentCtx.fillStyle = t.color;
          contentCtx.font = `${t.fontSize}px Inter, ui-sans-serif, system-ui`;
          contentCtx.textBaseline = "top";
          const lines = t.text.split("\n");
          for (let i = 0; i < lines.length; i++) {
            contentCtx.fillText(lines[i], t.x, t.y + i * (t.fontSize + 6));
          }
        }

        if (item.type === "image") {
          const im = item.data;
          contentCtx.globalCompositeOperation = "source-over";
          let cached = imageCacheRef.current.get(im.src);
          if (!cached) {
            const img = new Image();
            img.src = im.src;
            imageCacheRef.current.set(im.src, img);
            cached = img;
          }
          if (cached.complete && cached.naturalWidth > 0) {
            contentCtx.drawImage(cached, im.x, im.y, im.width, im.height);
          }
        }
      }

      if (tool === "select" && selectedId) {
        const selEntry = items.find(
          (it) =>
            (it.type === "image" && it.data.id === selectedId) ||
            (it.type === "shape" && it.data.id === selectedId),
        );
        const sel = selEntry ? itemBounds(selEntry) : null;
        if (sel) {
          contentCtx.save();
          contentCtx.globalCompositeOperation = "source-over";
          const z = viewport.zoom;
          contentCtx.strokeStyle = "#3175F1";
          contentCtx.lineWidth = 1.5 / z;
          contentCtx.setLineDash([6 / z, 4 / z]);
          contentCtx.strokeRect(sel.x, sel.y, sel.w, sel.h);
          contentCtx.setLineDash([]);

          const hs = 10 / z;
          const handles = getHandleRects(sel, hs);
          contentCtx.lineWidth = 1 / z;
          for (const k of Object.keys(handles) as Handle[]) {
            const r = handles[k];
            contentCtx.fillStyle = "#ffffff";
            contentCtx.fillRect(r.x, r.y, r.w, r.h);
            contentCtx.strokeStyle = "#3175F1";
            contentCtx.strokeRect(r.x, r.y, r.w, r.h);
          }

          const label = `${Math.round(sel.w)} × ${Math.round(sel.h)}`;
          const fontSize = 11 / z;
          contentCtx.font = `${fontSize}px Inter, ui-sans-serif, system-ui`;
          contentCtx.textBaseline = "top";
          const padX = 6 / z;
          const padY = 3 / z;
          const textW = contentCtx.measureText(label).width;
          const boxW = textW + padX * 2;
          const boxH = fontSize + padY * 2;
          const labelX = sel.x + sel.w / 2 - boxW / 2;
          const labelY = sel.y + sel.h + 8 / z;
          contentCtx.fillStyle = "#3175F1";
          contentCtx.fillRect(labelX, labelY, boxW, boxH);
          contentCtx.fillStyle = "#ffffff";
          contentCtx.fillText(label, labelX + padX, labelY + padY);
          contentCtx.restore();
        }
      }

      contentCtx.restore();

      // ===== DRAW MAIN CANVAS (background + grid + content) =====
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "#F7FAFC";
      ctx.fillRect(0, 0, w, h);

      // Grid
      const gridSize = 22;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(45,55,72,0.10)";
      ctx.lineWidth = 1;
      for (let x = (viewport.x % (gridSize * viewport.zoom)); x < w; x += gridSize * viewport.zoom) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = (viewport.y % (gridSize * viewport.zoom)); y < h; y += gridSize * viewport.zoom) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Composite content layer on top (now with transparent holes where eraser was used)
      ctx.drawImage(contentCanvas, 0, 0, w, h);

      ctx.restore();
    };
  }, [activeShape, activeStroke, items, viewport.x, viewport.y, viewport.zoom, selectedId, tool]);

  useEffect(() => {
    const loop = () => {
      draw();
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const pushItem = (item: BoardItem) => {
    commitHistory();
    setItems((prev) => [...prev, item]);
    broadcastDraw(item);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const p = toCanvasPoint(e.clientX, e.clientY, viewport, rect);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsPointerDown(true);
    if (contextMenu) setContextMenu(null);

    if (tool === "hand" || (tool === "select" && (e.button === 1 || e.ctrlKey || e.metaKey))) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y });
      return;
    }

    if (tool === "select") {
      const selected = findBounds(selectedId);
      if (selected) {
        const h = hitHandle(p, selected, viewport.zoom);
        if (h) {
          dragPreSnapshotRef.current = itemsRef.current;
          setDragMode({ kind: "resize", handle: h, startMouse: p, startBounds: selected });
          return;
        }
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const b = itemBounds(it);
        if (b && hitBounds(p, b)) {
          setSelectedId(b.id);
          dragPreSnapshotRef.current = itemsRef.current;
          setDragMode({ kind: "move", startMouse: p, startBounds: b });
          return;
        }
      }
      setSelectedId(null);
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      const s: Stroke = {
        id: uid(),
        tool: tool === "eraser" ? "eraser" : "pen",
        color,
        size: tool === "eraser" ? Math.max(10, strokeSize * 4) : strokeSize,
        points: [p],
      };
      setActiveStroke(s);
      return;
    }

    if (tool === "rect" || tool === "ellipse") {
      setShapeStart(p);
      const sh: Shape = {
        id: uid(),
        kind: tool === "rect" ? "rect" : "ellipse",
        x: p.x,
        y: p.y,
        w: 0,
        h: 0,
        stroke: color,
        fill,
        strokeWidth: 2,
      };
      setActiveShape(sh);
      return;
    }

    if (tool === "text") {
      const text = window.prompt("Add text", "");
      if (text && text.trim()) {
        pushItem({
          type: "text",
          data: {
            id: uid(),
            x: p.x,
            y: p.y,
            text: text.trim(),
            color,
            fontSize: 18,
          },
        });
      }
      return;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const p = toCanvasPoint(e.clientX, e.clientY, viewport, rect);

    // Broadcast cursor position to peers
    broadcastCursor(p.x, p.y, true);

    if (!isPointerDown) {
      if (tool === "select") {
        const selected = findBounds(selectedId);
        const hh = selected ? hitHandle(p, selected, viewport.zoom) : null;
        setHoverHandle(hh);
        if (hh) {
          setHoverItemId(null);
        } else {
          let hoverId: string | null = null;
          for (let i = items.length - 1; i >= 0; i--) {
            const b = itemBounds(items[i]);
            if (b && hitBounds(p, b)) {
              hoverId = b.id;
              break;
            }
          }
          setHoverItemId(hoverId);
        }
      } else if (hoverHandle || hoverItemId) {
        setHoverHandle(null);
        setHoverItemId(null);
      }
      return;
    }

    if (dragMode) {
      const start = dragMode.startBounds;
      const dx = p.x - dragMode.startMouse.x;
      const dy = p.y - dragMode.startMouse.y;
      if (dragPreSnapshotRef.current && (dx !== 0 || dy !== 0)) {
        setPast((pst) => [...pst, dragPreSnapshotRef.current!]);
        setFuture([]);
        dragPreSnapshotRef.current = null;
      }
      if (dragMode.kind === "move") {
        updateItemBounds(start.id, { x: start.x + dx, y: start.y + dy, w: start.w, h: start.h });
      } else {
        const MIN = 10;
        let nx = start.x;
        let ny = start.y;
        let nw = start.w;
        let nh = start.h;
        switch (dragMode.handle) {
          case "e":
            nw = Math.max(MIN, start.w + dx);
            break;
          case "w":
            nw = Math.max(MIN, start.w - dx);
            nx = start.x + (start.w - nw);
            break;
          case "s":
            nh = Math.max(MIN, start.h + dy);
            break;
          case "n":
            nh = Math.max(MIN, start.h - dy);
            ny = start.y + (start.h - nh);
            break;
          case "se":
            nw = Math.max(MIN, start.w + dx);
            nh = Math.max(MIN, start.h + dy);
            break;
          case "ne":
            nw = Math.max(MIN, start.w + dx);
            nh = Math.max(MIN, start.h - dy);
            ny = start.y + (start.h - nh);
            break;
          case "sw":
            nw = Math.max(MIN, start.w - dx);
            nx = start.x + (start.w - nw);
            nh = Math.max(MIN, start.h + dy);
            break;
          case "nw":
            nw = Math.max(MIN, start.w - dx);
            nx = start.x + (start.w - nw);
            nh = Math.max(MIN, start.h - dy);
            ny = start.y + (start.h - nh);
            break;
        }
        if (start.type === "image" && dragMode.handle.length === 2) {
          const aspect = start.w / start.h;
          if (nw / aspect > nh) nh = nw / aspect;
          else nw = nh * aspect;
          if (dragMode.handle.includes("n")) ny = start.y + start.h - nh;
          if (dragMode.handle.includes("w")) nx = start.x + start.w - nw;
        }
        updateItemBounds(start.id, { x: nx, y: ny, w: nw, h: nh });
      }
      return;
    }

    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewport((v) => ({ ...v, x: panStart.vx + dx, y: panStart.vy + dy }));
      return;
    }

    if (activeStroke) {
      setActiveStroke((s) => {
        if (!s) return s;
        const last = s.points[s.points.length - 1];
        const dist = Math.hypot(p.x - last.x, p.y - last.y);
        if (dist < 0.65) return s;
        return { ...s, points: [...s.points, p] };
      });
      return;
    }

    if (activeShape && shapeStart) {
      const x = Math.min(shapeStart.x, p.x);
      const y = Math.min(shapeStart.y, p.y);
      const w = Math.abs(p.x - shapeStart.x);
      const h = Math.abs(p.y - shapeStart.y);
      setActiveShape((sh) => (sh ? { ...sh, x, y, w, h } : sh));
    }
  };

  const onPointerUp = () => {
    setIsPointerDown(false);

    if (dragMode) {
      dragPreSnapshotRef.current = null;
      setDragMode(null);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (activeStroke) {
      const s = activeStroke;
      setActiveStroke(null);
      if (s.points.length > 1) pushItem({ type: "stroke", data: s });
      return;
    }

    if (activeShape) {
      const sh = activeShape;
      setActiveShape(null);
      setShapeStart(null);
      if (Math.abs(sh.w) > 2 && Math.abs(sh.h) > 2) pushItem({ type: "shape", data: sh });
      return;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.06 : 0.94;
    const next = clamp(zoom * factor, 0.35, 2.5);

    const canvas = canvasRef.current;
    if (!canvas) {
      setZoom(next);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const before = toCanvasPoint(e.clientX, e.clientY, viewport, rect);

    // compute new viewport to zoom around mouse position
    const nextViewportZoom = next;
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;

    const nextX = vx - before.x * nextViewportZoom;
    const nextY = vy - before.y * nextViewportZoom;

    setZoom(next);
    setViewport((v) => ({ ...v, x: nextX, y: nextY, zoom: nextViewportZoom }));
  };

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prevSnap = p[p.length - 1];
      setFuture((f) => [...f, itemsRef.current]);
      setItems(prevSnap);
      setSelectedId((id) =>
        id &&
        prevSnap.some(
          (it) =>
            (it.type === "image" && it.data.id === id) ||
            (it.type === "shape" && it.data.id === id),
        )
          ? id
          : null,
      );
      return p.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nextSnap = f[f.length - 1];
      setPast((p) => [...p, itemsRef.current]);
      setItems(nextSnap);
      setSelectedId((id) =>
        id &&
        nextSnap.some(
          (it) =>
            (it.type === "image" && it.data.id === id) ||
            (it.type === "shape" && it.data.id === id),
        )
          ? id
          : null,
      );
      return f.slice(0, -1);
    });
  };

  const clearBoard = () => {
    commitHistory();
    setItems([]);
    setActiveShape(null);
    setActiveStroke(null);
    broadcastClear();
  };

  const resetView = () => {
    setZoom(1);
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  const exportPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `collabboard-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const saveSnapshot = () => {
    // Mock: "saved" state in-memory only.
    window.dispatchEvent(
      new CustomEvent("toast", {
        detail: {
          title: "Saved",
          description: "Snapshot saved locally (mock).",
        },
      }),
    );
  };

  useEffect(() => {
    if (!contextMenu) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-testid="context-menu"]')) return;
      setContextMenu(null);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (!modifier && (e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        commitHistory();
        setItems((prev) =>
          prev.filter(
            (it) =>
              !(
                (it.type === "image" && it.data.id === selectedId) ||
                (it.type === "shape" && it.data.id === selectedId)
              ),
          ),
        );
        setSelectedId(null);
        return;
      }

      if (!modifier && e.key === "Escape") {
        if (contextMenu) setContextMenu(null);
        if (selectedId) setSelectedId(null);
        return;
      }

      if (!modifier && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "v":
            setTool("select");
            break;
          case "h":
            setTool("hand");
            break;
          case "p":
            setTool("pen");
            break;
          case "r":
            setTool("rect");
            break;
          case "o":
            setTool("ellipse");
            break;
          case "t":
            setTool("text");
            break;
          case "e":
            setTool("eraser");
            break;
        }
      }

      if (modifier) {
        if (e.key.toLowerCase() === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
          e.preventDefault();
          redo();
        } else if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          saveSnapshot();
        } else if (e.code === "BracketRight" && selectedId) {
          e.preventDefault();
          reorderSelected(e.shiftKey ? "front" : "forward");
        } else if (e.code === "BracketLeft" && selectedId) {
          e.preventDefault();
          reorderSelected(e.shiftKey ? "back" : "backward");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, saveSnapshot, selectedId, reorderSelected, contextMenu]);

  const insertImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const canvas = canvasRef.current;
        const container = containerRef.current;
        let cx = 200;
        let cy = 200;
        if (canvas && container) {
          const rect = container.getBoundingClientRect();
          const center = toCanvasPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            viewport,
            rect,
          );
          cx = center.x - w / 2;
          cy = center.y - h / 2;
        }

        imageCacheRef.current.set(dataUrl, img);
        const newId = uid();
        pushItem({
          type: "image",
          data: { id: newId, x: cx, y: cy, width: w, height: h, src: dataUrl },
        });
        setSelectedId(newId);
        setTool("select");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const collaborators = useMemo(() => {
    const now = Date.now();
    // Include self + remote peers
    const allPeers = [
      { id: "me", name: myName, color: myColor, active: true, lastSeen: now },
      ...remotePeers.filter((p) => now - p.lastSeen < 15000)
    ];
    return allPeers.map((c) => ({ id: c.id, name: c.name, color: c.color, active: c.active }));
  }, [remotePeers, myName, myColor]);

  return (
    <div className="relative h-full w-full bg-white">
      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur cb-noise"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-slate-900 text-white">
                <PenTool className="size-[18px]" />
              </div>
              <div className="leading-tight">
                <div data-testid="text-app-title" className="text-sm font-semibold text-slate-900">
                  CollabBoard
                </div>
                <div data-testid="text-app-subtitle" className="text-xs text-slate-500">
                  {isConnected ? `P2P connected · ${peerCount} peer${peerCount !== 1 ? 's' : ''}` : "Connecting..."}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="pointer-events-auto flex items-center gap-2"
          >
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur cb-noise">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-slate-600" />
                <div data-testid="text-collaborators" className="text-xs font-medium text-slate-700">
                  {collaborators.length} online
                </div>
                <div className="flex -space-x-2 pl-1">
                  {collaborators.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      data-testid={`img-collaborator-${c.id}`}
                      className="grid size-7 place-items-center rounded-full border border-white bg-white shadow-sm"
                      style={{ boxShadow: `0 0 0 2px rgba(255,255,255,0.95), 0 8px 20px rgba(15,23,42,0.08)` }}
                    >
                      <div
                        className="grid size-6 place-items-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundColor: c.color }}
                        title={c.name}
                      >
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button
              data-testid="button-export"
              onClick={exportPng}
              variant="secondary"
              className="rounded-2xl border border-slate-200/70 bg-white/80 text-slate-800 shadow-sm backdrop-blur hover:bg-white"
            >
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Left floating toolbar */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center pl-4">
        <div className="flex flex-col items-start gap-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="pointer-events-auto rounded-2xl border border-slate-200/70 bg-white/85 p-2 shadow-md backdrop-blur cb-noise"
          >
            <div className="flex flex-col gap-2">
              <ToolButton
                testId="button-tool-select"
                label="Select"
                shortcut="V"
                active={tool === "select"}
                onClick={() => setTool("select")}
                icon={<MousePointer2 className="size-[18px]" />}
              />
              <ToolButton
                testId="button-tool-hand"
                label="Pan"
                shortcut="H"
                active={tool === "hand"}
                onClick={() => setTool("hand")}
                icon={<Hand className="size-[18px]" />}
              />
              <div className="my-1 h-px bg-slate-200/70" />
              <ToolButton
                testId="button-tool-pen"
                label="Pen"
                shortcut="P"
                active={tool === "pen"}
                onClick={() => setTool("pen")}
                icon={<PenTool className="size-[18px]" />}
              />
              <ToolButton
                testId="button-tool-rect"
                label="Rectangle"
                shortcut="R"
                active={tool === "rect"}
                onClick={() => setTool("rect")}
                icon={<Square className="size-[18px]" />}
              />
              <ToolButton
                testId="button-tool-ellipse"
                label="Ellipse"
                shortcut="O"
                active={tool === "ellipse"}
                onClick={() => setTool("ellipse")}
                icon={<Circle className="size-[18px]" />}
              />
              <ToolButton
                testId="button-tool-text"
                label="Text"
                shortcut="T"
                active={tool === "text"}
                onClick={() => setTool("text")}
                icon={<TextCursor className="size-[18px]" />}
              />
              <ToolButton
                testId="button-tool-image"
                label="Insert Image"
                active={false}
                onClick={insertImage}
                icon={<ImagePlus className="size-[18px]" />}
              />
              <ToolButton
                testId="button-tool-eraser"
                label="Eraser"
                shortcut="E"
                active={tool === "eraser"}
                onClick={() => setTool("eraser")}
                icon={<Eraser className="size-[18px]" />}
              />

              <div className="my-1 h-px bg-slate-200/70" />

              <ToolButton
                testId="button-undo"
                label="Undo"
                shortcut="⌘Z"
                active={false}
                onClick={undo}
                icon={<RotateCcw className="size-[18px]" />}
              />
              <ToolButton
                testId="button-redo"
                label="Redo"
                shortcut="⇧⌘Z"
                active={false}
                onClick={redo}
                icon={<Redo2 className="size-[18px]" />}
              />

              <div className="my-1 h-px bg-slate-200/70" />

              <ToolButton
                testId="button-clear"
                label="Clear board"
                active={false}
                onClick={clearBoard}
                icon={<Trash2 className="size-[18px]" />}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.03 }}
            className="pointer-events-auto rounded-2xl border border-slate-200/70 bg-white/85 p-2 shadow-md backdrop-blur cb-noise"
          >
            <div className="rounded-xl border border-slate-200/70 bg-white/70 p-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-700">Color</div>
                <div className="text-[11px] text-slate-500">Stroke</div>
              </div>
              
              <ColorPicker
                value={customColor}
                onChange={(c) => {
                  const f = c + "1A";
                  setCustomColor(c);
                  setColor(c);
                  setFill(f);
                  recolorSelected(c, f);
                }}
              />

              <div className="mt-3 grid grid-cols-3 gap-2">
                {PRESET_COLORS.map((c) => (
                  <ColorDot
                    key={c.value}
                    value={c.value}
                    active={color.toLowerCase() === c.value.toLowerCase()}
                    onClick={() => {
                      const f =
                        c.value === "#3182CE"
                          ? "rgba(49,130,206,0.10)"
                          : c.value === "#805AD5"
                            ? "rgba(128,90,213,0.10)"
                            : c.value + "1A";
                      setColor(c.value);
                      setCustomColor(c.value);
                      setFill(f);
                      recolorSelected(c.value, f);
                    }}
                    testId={`button-color-${c.name.toLowerCase()}`}
                  />
                ))}
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-700">Size</div>
                  <div data-testid="text-size" className="text-[11px] text-slate-500">
                    {strokeSize}px
                  </div>
                </div>
                <div className="mt-2 px-1">
                  <Slider
                    data-testid="slider-size"
                    value={[strokeSize]}
                    min={1}
                    max={14}
                    step={1}
                    onValueChange={(v) => setStrokeSize(v[0] ?? 3)}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Contextual arrange toolbar */}
      {selectedId && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto absolute left-1/2 top-4 z-40 -translate-x-1/2"
          data-testid="arrange-toolbar"
        >
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/90 p-1 shadow-md backdrop-blur cb-noise">
            <ArrangeButton
              testId="button-bring-to-front"
              label="Bring to front"
              shortcut="⇧⌘]"
              onClick={() => reorderSelected("front")}
              icon={<BringToFront className="size-[16px]" />}
            />
            <ArrangeButton
              testId="button-bring-forward"
              label="Bring forward"
              shortcut="⌘]"
              onClick={() => reorderSelected("forward")}
              icon={<ChevronUp className="size-[16px]" />}
            />
            <ArrangeButton
              testId="button-send-backward"
              label="Send backward"
              shortcut="⌘["
              onClick={() => reorderSelected("backward")}
              icon={<ChevronDown className="size-[16px]" />}
            />
            <ArrangeButton
              testId="button-send-to-back"
              label="Send to back"
              shortcut="⇧⌘["
              onClick={() => reorderSelected("back")}
              icon={<SendToBack className="size-[16px]" />}
            />
          </div>
        </motion.div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="pointer-events-auto fixed z-50 w-56 rounded-xl border border-slate-200/70 bg-white/95 p-1 text-sm shadow-lg backdrop-blur cb-noise"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-testid="context-menu"
          onContextMenu={(e) => e.preventDefault()}
        >
          <ContextMenuItem
            label="Bring to front"
            shortcut="⇧⌘]"
            onClick={() => {
              reorderSelected("front");
              setContextMenu(null);
            }}
          />
          <ContextMenuItem
            label="Bring forward"
            shortcut="⌘]"
            onClick={() => {
              reorderSelected("forward");
              setContextMenu(null);
            }}
          />
          <ContextMenuItem
            label="Send backward"
            shortcut="⌘["
            onClick={() => {
              reorderSelected("backward");
              setContextMenu(null);
            }}
          />
          <ContextMenuItem
            label="Send to back"
            shortcut="⇧⌘["
            onClick={() => {
              reorderSelected("back");
              setContextMenu(null);
            }}
          />
          <div className="my-1 h-px bg-slate-200/70" />
          <ContextMenuItem
            label="Delete"
            shortcut="⌫"
            danger
            onClick={() => {
              const id = contextMenu.id;
              commitHistory();
              setItems((prev) =>
                prev.filter(
                  (it) =>
                    !(
                      (it.type === "image" && it.data.id === id) ||
                      (it.type === "shape" && it.data.id === id)
                    ),
                ),
              );
              setSelectedId(null);
              setContextMenu(null);
            }}
          />
        </div>
      )}

      {/* Bottom right zoom controls */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-30 p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/85 px-2 py-2 shadow-md backdrop-blur cb-noise"
        >
          <button
            type="button"
            data-testid="button-zoom-out"
            onClick={() => setZoom((z) => clamp(z / 1.12, 0.35, 2.5))}
            className="grid size-10 place-items-center rounded-xl border border-slate-200/70 bg-white/70 text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
          >
            <Minus className="size-[18px]" />
          </button>

          <div className="min-w-[86px] text-center">
            <div data-testid="text-zoom" className="text-xs font-semibold text-slate-900">
              {displayedZoomPct}
            </div>
            <div className="text-[11px] text-slate-500">Zoom</div>
          </div>

          <button
            type="button"
            data-testid="button-zoom-in"
            onClick={() => setZoom((z) => clamp(z * 1.12, 0.35, 2.5))}
            className="grid size-10 place-items-center rounded-xl border border-slate-200/70 bg-white/70 text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
          >
            <Plus className="size-[18px]" />
          </button>

          <Button
            data-testid="button-reset-view"
            onClick={resetView}
            variant="secondary"
            className="rounded-2xl border border-slate-200/70 bg-white/70 text-slate-800 hover:bg-white"
          >
            Reset
          </Button>

          <Button
            data-testid="button-save"
            onClick={saveSnapshot}
            className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
          >
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </motion.div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Canvas stage */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full">
          <canvas
            ref={canvasRef}
            data-testid="canvas-board"
            className={cn(
              "h-full w-full touch-none",
              tool === "hand"
                ? "cursor-grab"
                : tool === "select"
                  ? dragMode?.kind === "resize"
                    ? HANDLE_CURSOR_CLASS[dragMode.handle]
                    : dragMode?.kind === "move"
                      ? "cursor-grabbing"
                      : hoverHandle
                        ? HANDLE_CURSOR_CLASS[hoverHandle]
                        : hoverItemId
                          ? "cursor-move"
                          : "cursor-default"
                  : "cursor-crosshair",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onContextMenu={(e) => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const p = toCanvasPoint(e.clientX, e.clientY, viewport, rect);
              for (let i = items.length - 1; i >= 0; i--) {
                const b = itemBounds(items[i]);
                if (b && hitBounds(p, b)) {
                  e.preventDefault();
                  setSelectedId(b.id);
                  setContextMenu({ x: e.clientX, y: e.clientY, id: b.id });
                  return;
                }
              }
              setContextMenu(null);
            }}
          />

          {/* Presence layer */}
          <div className="pointer-events-none absolute inset-0">
            {remotePeers.map((c) => (
              <div
                key={c.id}
                data-testid={`cursor-remote-${c.id}`}
                className={cn(
                  "absolute transition-opacity duration-300",
                  Date.now() - c.lastSeen > 3000 ? "opacity-0" : "opacity-100",
                )}
                style={{
                  transform: `translate(${c.x * viewport.zoom + viewport.x}px, ${c.y * viewport.zoom + viewport.y}px)`,
                }}
              >
                <div className="-translate-x-1 -translate-y-1">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 3l7.7 17 1.9-7.4 7.4-1.9L4 3z"
                      fill={c.color}
                      opacity={0.92}
                    />
                    <path d="M4 3l7.7 17 1.9-7.4 7.4-1.9L4 3z" stroke="rgba(15,23,42,0.18)" />
                  </svg>
                </div>
                <div
                  className="ml-4 -mt-1 inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur"
                  style={{ boxShadow: "0 10px 25px rgba(15,23,42,0.10)" }}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{c.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Help */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-20">
            <div className="pointer-events-auto max-w-[340px] rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-xs text-slate-600 shadow-sm backdrop-blur cb-noise">
              <div className="font-semibold text-slate-800">Tips</div>
              <ul className="mt-1 space-y-1">
                <li>
                  <span className="font-medium text-slate-700">Draw:</span> Pen / Shapes / Eraser
                </li>
                <li>
                  <span className="font-medium text-slate-700">Pan:</span> Pan tool
                </li>
                <li>
                  <span className="font-medium text-slate-700">Zoom:</span> Ctrl/Cmd + mouse wheel
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
