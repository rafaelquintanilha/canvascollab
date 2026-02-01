import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Download,
  Eraser,
  Hand,
  Minus,
  MousePointer2,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Square,
  TextCursor,
  Trash2,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
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

export type BoardItem =
  | { type: "stroke"; data: Stroke }
  | { type: "shape"; data: Shape }
  | { type: "text"; data: TextItem };

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
  { name: "Blue", value: "#3182CE" },
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
}: {
  active?: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  testId: string;
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
      </TooltipContent>
    </Tooltip>
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

export default function WhiteboardPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>("#3182CE");
  const [fill, setFill] = useState<string>("rgba(49,130,206,0.10)");
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
  
  const [redoStack, setRedoStack] = useState<BoardItem[]>([]);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [activeShape, setActiveShape] = useState<Shape | null>(null);
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // Collaboration: handle remote operations
  const handleRemoteDraw = useCallback((item: BoardItem) => {
    setItems((prev) => [...prev, item]);
    setRedoStack([]);
  }, []);

  const handleRemoteClear = useCallback(() => {
    setItems([]);
    setRedoStack([]);
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
    setRedoStack([]);
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

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

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

      // Apply viewport transform
      ctx.translate(viewport.x, viewport.y);
      ctx.scale(viewport.zoom, viewport.zoom);

      const all: BoardItem[] = [...items];
      if (activeShape) all.push({ type: "shape", data: activeShape });
      if (activeStroke) all.push({ type: "stroke", data: activeStroke });

      for (const item of all) {
        if (item.type === "stroke") {
          const s = item.data;
          if (s.points.length < 2) continue;

          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = s.size;
          if (s.tool === "eraser") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
          } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = s.color;
          }

          ctx.beginPath();
          ctx.moveTo(s.points[0].x, s.points[0].y);
          for (let i = 1; i < s.points.length; i++) {
            const p = s.points[i];
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }

        if (item.type === "shape") {
          const sh = item.data;
          ctx.globalCompositeOperation = "source-over";
          ctx.lineWidth = sh.strokeWidth;
          ctx.strokeStyle = sh.stroke;
          ctx.fillStyle = sh.fill;

          if (sh.kind === "rect") {
            ctx.beginPath();
            ctx.rect(sh.x, sh.y, sh.w, sh.h);
            ctx.fill();
            ctx.stroke();
          } else {
            const cx = sh.x + sh.w / 2;
            const cy = sh.y + sh.h / 2;
            const rx = Math.abs(sh.w / 2);
            const ry = Math.abs(sh.h / 2);
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }

        if (item.type === "text") {
          const t = item.data;
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = t.color;
          ctx.font = `${t.fontSize}px Inter, ui-sans-serif, system-ui`;
          ctx.textBaseline = "top";
          const lines = t.text.split("\n");
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], t.x, t.y + i * (t.fontSize + 6));
          }
        }
      }

      ctx.restore();
    };
  }, [activeShape, activeStroke, items, viewport.x, viewport.y, viewport.zoom]);

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
    setItems((prev) => [...prev, item]);
    setRedoStack([]);
    broadcastDraw(item);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const p = toCanvasPoint(e.clientX, e.clientY, viewport, rect);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsPointerDown(true);

    if (tool === "hand" || (tool === "select" && (e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey))) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y });
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

    if (!isPointerDown) return;

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
    setItems((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      const popped = prev[prev.length - 1];
      setRedoStack((r) => [...r, popped]);
      return next;
    });
  };

  const redo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const popped = prev[prev.length - 1];
      setItems((itemsPrev) => [...itemsPrev, popped]);
      return prev.slice(0, -1);
    });
  };

  const clearBoard = () => {
    setItems([]);
    setRedoStack([]);
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
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="pointer-events-auto rounded-2xl border border-slate-200/70 bg-white/85 p-2 shadow-md backdrop-blur cb-noise"
        >
          <div className="flex flex-col gap-2">
            <ToolButton
              testId="button-tool-select"
              label="Select"
              active={tool === "select"}
              onClick={() => setTool("select")}
              icon={<MousePointer2 className="size-[18px]" />}
            />
            <ToolButton
              testId="button-tool-hand"
              label="Pan"
              active={tool === "hand"}
              onClick={() => setTool("hand")}
              icon={<Hand className="size-[18px]" />}
            />
            <div className="my-1 h-px bg-slate-200/70" />
            <ToolButton
              testId="button-tool-pen"
              label="Pen"
              active={tool === "pen"}
              onClick={() => setTool("pen")}
              icon={<PenTool className="size-[18px]" />}
            />
            <ToolButton
              testId="button-tool-rect"
              label="Rectangle"
              active={tool === "rect"}
              onClick={() => setTool("rect")}
              icon={<Square className="size-[18px]" />}
            />
            <ToolButton
              testId="button-tool-ellipse"
              label="Ellipse"
              active={tool === "ellipse"}
              onClick={() => setTool("ellipse")}
              icon={<Circle className="size-[18px]" />}
            />
            <ToolButton
              testId="button-tool-text"
              label="Text"
              active={tool === "text"}
              onClick={() => setTool("text")}
              icon={<TextCursor className="size-[18px]" />}
            />
            <ToolButton
              testId="button-tool-eraser"
              label="Eraser"
              active={tool === "eraser"}
              onClick={() => setTool("eraser")}
              icon={<Eraser className="size-[18px]" />}
            />

            <div className="my-1 h-px bg-slate-200/70" />

            <ToolButton
              testId="button-undo"
              label="Undo"
              active={false}
              onClick={undo}
              icon={<RotateCcw className="size-[18px]" />}
            />
            <ToolButton
              testId="button-redo"
              label="Redo"
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

          <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/70 p-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-700">Color</div>
              <div className="text-[11px] text-slate-500">Stroke</div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRESET_COLORS.map((c) => (
                <ColorDot
                  key={c.value}
                  value={c.value}
                  active={color.toLowerCase() === c.value.toLowerCase()}
                  onClick={() => {
                    setColor(c.value);
                    setFill(c.value === "#3182CE" ? "rgba(49,130,206,0.10)" : "rgba(128,90,213,0.10)");
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

      {/* Canvas stage */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full">
          <canvas
            ref={canvasRef}
            data-testid="canvas-board"
            className={cn(
              "h-full w-full touch-none",
              tool === "hand" ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
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
