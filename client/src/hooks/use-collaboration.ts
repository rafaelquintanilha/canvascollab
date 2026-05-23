import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardItem } from "../pages/whiteboard";

type PeerId = string;

interface PeerInfo {
  id: PeerId;
  name: string;
  color: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  connected: boolean;
  isInitiator: boolean;
}

interface PeerIdentity {
  id: PeerId;
  name: string;
  color: string;
}

interface CursorUpdate {
  type: "cursor";
  x: number;
  y: number;
  active: boolean;
}

interface DrawOperation {
  type: "draw";
  item: BoardItem;
}

interface ClearBoard {
  type: "clear";
}

interface SyncRequest {
  type: "sync-request";
  itemCount: number;
}

interface SyncResponse {
  type: "sync-response";
  items: BoardItem[];
}

interface PeerListMessage {
  type: "peers";
  peers: PeerIdentity[];
}

interface PeerJoinedMessage {
  type: "peer-joined";
  peer: PeerIdentity;
}

interface PeerLeftMessage {
  type: "peer-left";
  id: PeerId;
}

interface OfferMessage {
  type: "offer";
  from: PeerId;
  to: PeerId;
  offer: RTCSessionDescriptionInit;
  name: string;
  color: string;
}

interface AnswerMessage {
  type: "answer";
  from: PeerId;
  to: PeerId;
  answer: RTCSessionDescriptionInit;
}

interface IceCandidateMessage {
  type: "ice";
  from: PeerId;
  to: PeerId;
  candidate: RTCIceCandidateInit;
}

type PeerMessage = CursorUpdate | DrawOperation | ClearBoard | SyncRequest | SyncResponse;
type SignalMessage =
  | PeerListMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage;
type RelaySignalMessage = OfferMessage | AnswerMessage | IceCandidateMessage;

const PEER_NAMES = [
  "Avery",
  "Sam",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Quinn",
  "Skyler",
  "Dakota",
  "Reese",
  "Rowan",
  "Sage",
  "Phoenix",
  "Eden",
];

const PEER_COLORS = [
  "#805AD5",
  "#38B2AC",
  "#3182CE",
  "#E53E3E",
  "#D69E2E",
  "#38A169",
  "#DD6B20",
  "#6B46C1",
  "#EC4899",
  "#10B981",
];

function generatePeerId(): PeerId {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(2, 6);
}

function getRandomName(): string {
  return PEER_NAMES[Math.floor(Math.random() * PEER_NAMES.length)];
}

function getRandomColor(): string {
  return PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
}

function getSignalingUrl(roomId: string, peerId: string, name: string, color: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({
    roomId,
    peerId,
    name,
    color,
  });

  return `${protocol}//${window.location.host}/api/collab/ws?${params.toString()}`;
}

export interface RemotePeer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  active: boolean;
  lastSeen: number;
}

export function useCollaboration(
  roomId: string,
  onRemoteDraw: (item: BoardItem) => void,
  onRemoteClear: () => void,
  onSyncRequest: (itemCount: number) => BoardItem[],
  onSyncReceive: (items: BoardItem[]) => void,
) {
  const [myId] = useState<PeerId>(() => generatePeerId());
  const [myName] = useState(() => getRandomName());
  const [myColor] = useState(() => getRandomColor());
  const [peers, setPeers] = useState<Map<PeerId, PeerInfo>>(new Map());
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const peersRef = useRef<Map<PeerId, PeerInfo>>(peers);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  function setTrackedPeers(next: Map<PeerId, PeerInfo>) {
    peersRef.current = next;
    setPeers(next);
  }

  function addPeer(peer: PeerInfo) {
    const next = new Map(peersRef.current);
    next.set(peer.id, peer);
    setTrackedPeers(next);
  }

  function markPeerConnected(peerId: PeerId) {
    const peer = peersRef.current.get(peerId);
    if (!peer) return;
    peer.connected = true;
    setTrackedPeers(new Map(peersRef.current));
  }

  function closeAllPeers() {
    peersRef.current.forEach((peer) => {
      peer.connection.close();
    });
    setTrackedPeers(new Map());
    setRemotePeers([]);
  }

  function removePeer(peerId: PeerId) {
    const next = new Map(peersRef.current);
    const peer = next.get(peerId);

    if (peer) {
      peer.connection.close();
      next.delete(peerId);
      setTrackedPeers(next);
    }

    setRemotePeers((prev) => prev.filter((p) => p.id !== peerId));
  }

  function updateRemotePeer(
    id: string,
    name: string,
    color: string,
    x: number,
    y: number,
    active: boolean,
  ) {
    setRemotePeers((prev) => {
      const existing = prev.find((p) => p.id === id);
      const now = Date.now();

      if (existing) {
        return prev.map((p) => (p.id === id ? { ...p, x, y, active, lastSeen: now } : p));
      }

      return [...prev, { id, name, color, x, y, active, lastSeen: now }];
    });
  }

  function sendSignal(message: RelaySignalMessage) {
    const socket = wsRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }

  function setupDataChannel(peer: PeerInfo, dc: RTCDataChannel) {
    peer.dataChannel = dc;

    dc.onopen = () => {
      markPeerConnected(peer.id);
      console.log(
        `[Collab] Data channel opened with ${peer.name} (${peer.id}). I am initiator: ${peer.isInitiator}`,
      );
      updateRemotePeer(peer.id, peer.name, peer.color, 0, 0, false);

      const ourItems = onSyncRequest(0);
      console.log(`[Collab] Sending sync-request. I have ${ourItems.length} items.`);
      const msg: SyncRequest = { type: "sync-request", itemCount: ourItems.length };
      dc.send(JSON.stringify(msg));
    };

    dc.onclose = () => {
      removePeer(peer.id);
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as PeerMessage;
        handlePeerMessage(peer, msg);
      } catch (e) {
        console.error("Failed to parse peer message:", e);
      }
    };
  }

  function createPeerConnection(
    peerId: PeerId,
    peerName: string,
    peerColor: string,
    isInitiator: boolean,
  ): PeerInfo {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    const peer: PeerInfo = {
      id: peerId,
      name: peerName,
      color: peerColor,
      connection: pc,
      connected: false,
      isInitiator,
    };

    if (isInitiator) {
      const dc = pc.createDataChannel("collab", { ordered: true });
      setupDataChannel(peer, dc);
    } else {
      pc.ondatachannel = (event) => {
        setupDataChannel(peer, event.channel);
      };
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      sendSignal({
        type: "ice",
        from: myId,
        to: peerId,
        candidate: event.candidate.toJSON(),
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        markPeerConnected(peerId);
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        removePeer(peerId);
      }
    };

    return peer;
  }

  function handlePeerMessage(peer: PeerInfo, msg: PeerMessage) {
    console.log(`[Collab] Received ${msg.type} from ${peer.name}`);

    if (msg.type === "cursor") {
      updateRemotePeer(peer.id, peer.name, peer.color, msg.x, msg.y, msg.active);
    } else if (msg.type === "draw") {
      onRemoteDraw(msg.item);
    } else if (msg.type === "clear") {
      onRemoteClear();
    } else if (msg.type === "sync-request") {
      console.log(`[Collab] Sync requested. Peer has ${msg.itemCount} items.`);
      const ourItems = onSyncRequest(msg.itemCount);
      console.log(`[Collab] I have ${ourItems.length} items.`);

      if (ourItems.length > msg.itemCount) {
        const response: SyncResponse = { type: "sync-response", items: ourItems };
        console.log(`[Collab] Sending sync response with ${ourItems.length} items.`);
        if (peer.dataChannel?.readyState === "open") {
          peer.dataChannel.send(JSON.stringify(response));
        }
      } else {
        console.log(`[Collab] Not sending (peer has ${msg.itemCount}, I have ${ourItems.length})`);
      }
    } else if (msg.type === "sync-response") {
      console.log(`[Collab] Received sync response with ${msg.items.length} items.`);
      onSyncReceive(msg.items);
    }
  }

  async function initiateConnection(peerId: PeerId, peerName: string, peerColor: string) {
    if (peersRef.current.has(peerId)) return;

    const peer = createPeerConnection(peerId, peerName, peerColor, true);
    addPeer(peer);

    try {
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);

      sendSignal({
        type: "offer",
        from: myId,
        to: peerId,
        offer,
        name: myName,
        color: myColor,
      });
    } catch (e) {
      console.error("Failed to create offer:", e);
    }
  }

  async function handleOffer(msg: OfferMessage) {
    if (peersRef.current.has(msg.from)) return;

    const peer = createPeerConnection(msg.from, msg.name, msg.color, false);
    addPeer(peer);

    try {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(msg.offer));
      const answer = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(answer);

      sendSignal({
        type: "answer",
        from: myId,
        to: msg.from,
        answer,
      });
    } catch (e) {
      console.error("Failed to handle offer:", e);
    }
  }

  async function handleAnswer(msg: AnswerMessage) {
    const peer = peersRef.current.get(msg.from);
    if (!peer) return;

    try {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(msg.answer));
    } catch (e) {
      console.error("Failed to handle answer:", e);
    }
  }

  async function handleIceCandidate(msg: IceCandidateMessage) {
    const peer = peersRef.current.get(msg.from);
    if (!peer) return;

    try {
      await peer.connection.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } catch (e) {
      console.error("Failed to add ICE candidate:", e);
    }
  }

  function maybeConnectToPeer(peer: PeerIdentity, shouldInitiate: boolean) {
    if (peer.id === myId || peersRef.current.has(peer.id)) return;

    if (shouldInitiate) {
      console.log(`[Collab] Initiating connection to ${peer.name}`);
      void initiateConnection(peer.id, peer.name, peer.color);
    }
  }

  async function handleSignalMessage(msg: SignalMessage) {
    if (msg.type === "peers") {
      msg.peers.forEach((peer) => maybeConnectToPeer(peer, true));
    } else if (msg.type === "peer-joined") {
      maybeConnectToPeer(msg.peer, false);
    } else if (msg.type === "peer-left") {
      removePeer(msg.id);
    } else if (msg.type === "offer" && msg.to === myId) {
      console.log(`[Collab] Received offer from ${msg.from} (for me)`);
      await handleOffer(msg);
    } else if (msg.type === "answer" && msg.to === myId) {
      console.log(`[Collab] Received answer from ${msg.from} (for me)`);
      await handleAnswer(msg);
    } else if (msg.type === "ice" && msg.to === myId) {
      await handleIceCandidate(msg);
    }
  }

  useEffect(() => {
    if (!roomId || typeof WebSocket === "undefined") return;

    let disposed = false;

    const connect = () => {
      const socket = new WebSocket(getSignalingUrl(roomId, myId, myName, myColor));
      wsRef.current = socket;
      setIsConnected(false);

      socket.onopen = () => {
        if (disposed || wsRef.current !== socket) return;
        setIsConnected(true);
        console.log(`[Collab] Joined room ${roomId}`);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as SignalMessage;
          void handleSignalMessage(msg);
        } catch (e) {
          console.error("Failed to parse signaling message:", e);
        }
      };

      socket.onclose = () => {
        if (wsRef.current === socket) {
          wsRef.current = null;
          setIsConnected(false);
          closeAllPeers();
        }

        if (!disposed) {
          reconnectTimerRef.current = window.setTimeout(connect, 1500);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      disposed = true;

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      const socket = wsRef.current;
      wsRef.current = null;

      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }

      closeAllPeers();
    };
  }, [roomId, myId, myName, myColor]);

  const broadcastCursor = useCallback((x: number, y: number, active: boolean) => {
    const msg: CursorUpdate = { type: "cursor", x, y, active };
    peersRef.current.forEach((peer) => {
      if (peer.connected && peer.dataChannel?.readyState === "open") {
        peer.dataChannel.send(JSON.stringify(msg));
      }
    });
  }, []);

  const broadcastDraw = useCallback((item: BoardItem) => {
    const msg: DrawOperation = { type: "draw", item };
    peersRef.current.forEach((peer) => {
      if (peer.connected && peer.dataChannel?.readyState === "open") {
        peer.dataChannel.send(JSON.stringify(msg));
      }
    });
  }, []);

  const broadcastClear = useCallback(() => {
    const msg: ClearBoard = { type: "clear" };
    peersRef.current.forEach((peer) => {
      if (peer.connected && peer.dataChannel?.readyState === "open") {
        peer.dataChannel.send(JSON.stringify(msg));
      }
    });
  }, []);

  return {
    myId,
    myName,
    myColor,
    remotePeers,
    isConnected,
    peerCount: peers.size,
    broadcastCursor,
    broadcastDraw,
    broadcastClear,
  };
}
