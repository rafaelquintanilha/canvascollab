import type { Server as HttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";

type RoomId = string;
type PeerId = string;

type PeerClient = {
  id: PeerId;
  name: string;
  color: string;
  ws: WebSocket;
};

type RelayMessage = {
  type: "offer" | "answer" | "ice";
  to: string;
  [key: string]: unknown;
};

const COLLABORATION_WS_PATH = "/api/collab/ws";
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{3,80}$/;
const PEER_ID_PATTERN = /^[A-Za-z0-9_-]{3,80}$/;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const rooms = new Map<RoomId, Map<PeerId, PeerClient>>();

function getStringParam(url: URL, key: string, maxLength: number) {
  const value = url.searchParams.get(key)?.trim();
  if (!value || value.length > maxLength) return null;
  return value;
}

function getPeerIdentity(url: URL) {
  const roomId = getStringParam(url, "roomId", 80);
  const peerId = getStringParam(url, "peerId", 80);
  const name = getStringParam(url, "name", 40) ?? "Guest";
  const color = getStringParam(url, "color", 7) ?? "#3182CE";

  if (!roomId || !ROOM_ID_PATTERN.test(roomId)) return null;
  if (!peerId || !PEER_ID_PATTERN.test(peerId)) return null;

  return {
    roomId,
    peerId,
    name,
    color: COLOR_PATTERN.test(color) ? color : "#3182CE",
  };
}

function toPublicPeer(peer: PeerClient) {
  return {
    id: peer.id,
    name: peer.name,
    color: peer.color,
  };
}

function send(ws: WebSocket, message: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
}

function broadcast(room: Map<PeerId, PeerClient>, message: unknown, exceptPeerId?: PeerId) {
  for (const peer of Array.from(room.values())) {
    if (peer.id === exceptPeerId) continue;
    send(peer.ws, message);
  }
}

function isRelayMessage(message: unknown): message is RelayMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as RelayMessage;
  return (
    (candidate.type === "offer" || candidate.type === "answer" || candidate.type === "ice") &&
    typeof candidate.to === "string"
  );
}

export function setupCollaborationServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== COLLABORATION_WS_PATH) return;

    if (!getPeerIdentity(url)) {
      socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const identity = getPeerIdentity(url);

    if (!identity) {
      ws.close(1008, "Invalid collaboration identity");
      return;
    }

    const room = rooms.get(identity.roomId) ?? new Map<PeerId, PeerClient>();
    rooms.set(identity.roomId, room);

    const existingPeers = Array.from(room.values())
      .filter((peer) => peer.id !== identity.peerId)
      .map(toPublicPeer);

    const previous = room.get(identity.peerId);
    if (previous) {
      previous.ws.close(4000, "Peer reconnected");
    }

    const client: PeerClient = {
      id: identity.peerId,
      name: identity.name,
      color: identity.color,
      ws,
    };

    room.set(identity.peerId, client);

    send(ws, {
      type: "peers",
      peers: existingPeers,
    });

    broadcast(
      room,
      {
        type: "peer-joined",
        peer: toPublicPeer(client),
      },
      identity.peerId,
    );

    ws.on("message", (raw) => {
      let message: unknown;

      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!isRelayMessage(message)) return;

      const target = room.get(message.to);
      if (!target) return;

      send(target.ws, {
        ...message,
        from: identity.peerId,
      });
    });

    ws.on("close", () => {
      const current = room.get(identity.peerId);
      if (current?.ws !== ws) return;

      room.delete(identity.peerId);
      broadcast(room, { type: "peer-left", id: identity.peerId });

      if (room.size === 0) {
        rooms.delete(identity.roomId);
      }
    });

    ws.on("error", () => {
      ws.close();
    });
  });
}
