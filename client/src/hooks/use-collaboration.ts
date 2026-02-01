import { useEffect, useRef, useState, useCallback } from "react";
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

interface PresenceMessage {
  type: "presence";
  id: PeerId;
  name: string;
  color: string;
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
type SignalMessage = PresenceMessage | OfferMessage | AnswerMessage | IceCandidateMessage;

const PEER_NAMES = [
  "Avery", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn",
  "Skyler", "Dakota", "Reese", "Rowan", "Sage", "Phoenix", "Eden"
];

const PEER_COLORS = [
  "#805AD5", "#38B2AC", "#3182CE", "#E53E3E", "#D69E2E", 
  "#38A169", "#DD6B20", "#6B46C1", "#EC4899", "#10B981"
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
  onRemoteDraw: (item: BoardItem) => void,
  onRemoteClear: () => void,
  onSyncRequest: (itemCount: number) => BoardItem[],
  onSyncReceive: (items: BoardItem[]) => void
) {
  const [myId] = useState<PeerId>(() => generatePeerId());
  const [myName] = useState(() => getRandomName());
  const [myColor] = useState(() => getRandomColor());
  const [peers, setPeers] = useState<Map<PeerId, PeerInfo>>(new Map());
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const bcRef = useRef<BroadcastChannel | null>(null);
  const peersRef = useRef<Map<PeerId, PeerInfo>>(peers);
  const syncRequestedRef = useRef<Set<PeerId>>(new Set());
  
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  // Initialize BroadcastChannel for same-origin peer discovery
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    
    const bc = new BroadcastChannel("collab-board");
    bcRef.current = bc;
    
    // Announce presence when joining
    const announcePresence = () => {
      const msg: PresenceMessage = {
        type: "presence",
        id: myId,
        name: myName,
        color: myColor
      };
      bc.postMessage(msg);
    };
    
    // Announce immediately and periodically
    announcePresence();
    const interval = setInterval(announcePresence, 5000);
    
    bc.onmessage = async (event) => {
      const msg = event.data as SignalMessage;
      if (!msg || (msg.type === "presence" && msg.id === myId)) return;
      
      if (msg.type === "presence") {
        console.log(`[Collab] Discovered peer: ${msg.name} (${msg.id})`);
        // New peer discovered, initiate connection if we don't have one
        if (!peersRef.current.has(msg.id) && msg.id < myId) {
          console.log(`[Collab] Initiating connection to ${msg.name} (their ID < my ID)`);
          // Only initiate if our ID is "greater" to avoid double connections
          await initiateConnection(msg.id, msg.name, msg.color);
        }
      } else if (msg.type === "offer" && msg.to === myId) {
        console.log(`[Collab] Received offer from ${msg.from} (for me)`);
        await handleOffer(msg);
      } else if (msg.type === "answer" && msg.to === myId) {
        console.log(`[Collab] Received answer from ${msg.from} (for me)`);
        await handleAnswer(msg);
      } else if (msg.type === "ice" && msg.to === myId) {
        await handleIceCandidate(msg);
      }
    };
    
    setIsConnected(true);
    
    return () => {
      clearInterval(interval);
      bc.close();
      // Close all peer connections
      peersRef.current.forEach(peer => {
        peer.connection.close();
      });
    };
  }, [myId, myName, myColor]);

  const createPeerConnection = useCallback((peerId: PeerId, peerName: string, peerColor: string, isInitiator: boolean): PeerInfo => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });
    
    const peer: PeerInfo = {
      id: peerId,
      name: peerName,
      color: peerColor,
      connection: pc,
      connected: false,
      isInitiator
    };
    
    // Create data channel if initiator
    if (isInitiator) {
      const dc = pc.createDataChannel("collab", { ordered: true });
      setupDataChannel(peer, dc);
    } else {
      // Handle incoming data channel
      pc.ondatachannel = (event) => {
        setupDataChannel(peer, event.channel);
      };
    }
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && bcRef.current) {
        const msg: IceCandidateMessage = {
          type: "ice",
          from: myId,
          to: peerId,
          candidate: event.candidate.toJSON()
        };
        bcRef.current.postMessage(msg);
      }
    };
    
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setPeers(prev => {
          const next = new Map(prev);
          const p = next.get(peerId);
          if (p) {
            p.connected = true;
          }
          return next;
        });
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        removePeer(peerId);
      }
    };
    
    return peer;
  }, [myId]);

  const setupDataChannel = (peer: PeerInfo, dc: RTCDataChannel) => {
    peer.dataChannel = dc;
    
    dc.onopen = () => {
      peer.connected = true;
      console.log(`[Collab] Data channel opened with ${peer.name} (${peer.id}). I am initiator: ${peer.isInitiator}`);
      updateRemotePeer(peer.id, peer.name, peer.color, 0, 0, false);
      
      // BOTH sides send sync-request when connection opens
      // This ensures whoever has more items will send them
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
  };

  const handlePeerMessage = (peer: PeerInfo, msg: PeerMessage) => {
    console.log(`[Collab] Received ${msg.type} from ${peer.name}`);
    
    if (msg.type === "cursor") {
      updateRemotePeer(peer.id, peer.name, peer.color, msg.x, msg.y, msg.active);
    } else if (msg.type === "draw") {
      onRemoteDraw(msg.item);
    } else if (msg.type === "clear") {
      onRemoteClear();
    } else if (msg.type === "sync-request") {
      // Peer is requesting sync - send our items if we have MORE than them
      console.log(`[Collab] Sync requested. Peer has ${msg.itemCount} items.`);
      const ourItems = onSyncRequest(msg.itemCount);
      console.log(`[Collab] I have ${ourItems.length} items.`);
      
      // Send our items if we have more than the peer
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
      // Received sync data - apply it
      console.log(`[Collab] Received sync response with ${msg.items.length} items.`);
      onSyncReceive(msg.items);
    }
  };

  const initiateConnection = async (peerId: PeerId, peerName: string, peerColor: string) => {
    if (peersRef.current.has(peerId)) return;
    
    const peer = createPeerConnection(peerId, peerName, peerColor, true);
    setPeers(prev => new Map(prev).set(peerId, peer));
    
    try {
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      
      if (bcRef.current) {
        const msg: OfferMessage = {
          type: "offer",
          from: myId,
          to: peerId,
          offer: offer,
          name: myName,
          color: myColor
        };
        bcRef.current.postMessage(msg);
      }
    } catch (e) {
      console.error("Failed to create offer:", e);
    }
  };

  const handleOffer = async (msg: OfferMessage) => {
    if (peersRef.current.has(msg.from)) return;
    
    const peer = createPeerConnection(msg.from, msg.name, msg.color, false);
    setPeers(prev => new Map(prev).set(msg.from, peer));
    
    try {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(msg.offer));
      const answer = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(answer);
      
      if (bcRef.current) {
        const answerMsg: AnswerMessage = {
          type: "answer",
          from: myId,
          to: msg.from,
          answer: answer
        };
        bcRef.current.postMessage(answerMsg);
      }
    } catch (e) {
      console.error("Failed to handle offer:", e);
    }
  };

  const handleAnswer = async (msg: AnswerMessage) => {
    const peer = peersRef.current.get(msg.from);
    if (!peer) return;
    
    try {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(msg.answer));
    } catch (e) {
      console.error("Failed to handle answer:", e);
    }
  };

  const handleIceCandidate = async (msg: IceCandidateMessage) => {
    const peer = peersRef.current.get(msg.from);
    if (!peer) return;
    
    try {
      await peer.connection.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } catch (e) {
      console.error("Failed to add ICE candidate:", e);
    }
  };

  const removePeer = (peerId: PeerId) => {
    setPeers(prev => {
      const next = new Map(prev);
      const peer = next.get(peerId);
      if (peer) {
        peer.connection.close();
        next.delete(peerId);
      }
      return next;
    });
    
    setRemotePeers(prev => prev.filter(p => p.id !== peerId));
    syncRequestedRef.current.delete(peerId);
  };

  const updateRemotePeer = (id: string, name: string, color: string, x: number, y: number, active: boolean) => {
    setRemotePeers(prev => {
      const existing = prev.find(p => p.id === id);
      const now = Date.now();
      
      if (existing) {
        return prev.map(p => 
          p.id === id 
            ? { ...p, x, y, active, lastSeen: now }
            : p
        );
      } else {
        return [...prev, { id, name, color, x, y, active, lastSeen: now }];
      }
    });
  };

  const broadcastCursor = useCallback((x: number, y: number, active: boolean) => {
    const msg: CursorUpdate = { type: "cursor", x, y, active };
    peersRef.current.forEach(peer => {
      if (peer.connected && peer.dataChannel?.readyState === "open") {
        peer.dataChannel.send(JSON.stringify(msg));
      }
    });
  }, []);

  const broadcastDraw = useCallback((item: BoardItem) => {
    const msg: DrawOperation = { type: "draw", item };
    peersRef.current.forEach(peer => {
      if (peer.connected && peer.dataChannel?.readyState === "open") {
        peer.dataChannel.send(JSON.stringify(msg));
      }
    });
  }, []);

  const broadcastClear = useCallback(() => {
    const msg: ClearBoard = { type: "clear" };
    peersRef.current.forEach(peer => {
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
    broadcastClear
  };
}
