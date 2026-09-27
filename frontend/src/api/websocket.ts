export type ConnectionMode = 'websocket' | 'http_sync' | 'connecting';
export type ListenerCallback = (data: any) => void;
type StatusCallback = (connected: boolean, mode: ConnectionMode) => void;

class AgriVaultWebSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<ListenerCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 12000;
  private isConnecting = false;
  private isConnected = false;
  private connectionMode: ConnectionMode = 'connecting';
  private statusListeners: Set<StatusCallback> = new Set();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isFallbackMode = false;

  constructor() {
    // If hosted on Vercel where WebSockets are not supported by serverless functions,
    // seamlessly default to high-performance Cloud HTTP Sync mode immediately.
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('.vercel.app');
    if (isVercel) {
      console.log('[AgriVault Network] Vercel Serverless environment detected. Operating in Cloud HTTP Sync mode.');
      this.isFallbackMode = true;
      this.isConnected = true;
      this.connectionMode = 'http_sync';
      setTimeout(() => this.notifyStatus(true, 'http_sync'), 50);
      return;
    }

    this.connect();
  }

  public connect(): void {
    if (this.isFallbackMode) return;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Safely detach previous socket if closing
    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onmessage = null;
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }

    this.isConnecting = true;
    this.connectionMode = 'connecting';
    this.notifyStatus(false, 'connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // When running Vite dev server (port 3000), connect directly to backend (port 4000)
    let wsUrl = `${protocol}//${window.location.host}/ws`;
    if (window.location.hostname === 'localhost' && window.location.port === '3000') {
      wsUrl = 'ws://localhost:4000/ws';
    }

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.connectionMode = 'websocket';
        this.notifyStatus(true, 'websocket');
        console.log('[WebSocket] Real-time link connected to AgriVault Hub');

        // Start active client heartbeat every 15s to keep link alive through proxies
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
              this.socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            } catch {
              // ignore
            }
          }
        }, 15000);
      };

      this.socket.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === 'ping') {
            this.send('pong', { timestamp: Date.now() });
            return;
          }
          if (packet.type === 'pong') {
            return;
          }
          if (packet.type) {
            this.emit(packet.type, packet.data);
          }
        } catch {
          // ignore
        }
      };

      this.socket.onclose = () => {
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        this.isConnected = false;
        this.isConnecting = false;

        // If repeated failures occur (e.g. 3 attempts), gracefully fall back to HTTP sync
        // to prevent UI jitter, flashing badges, and browser console spam.
        if (this.reconnectAttempts >= 3) {
          console.log('[AgriVault Network] WebSocket unavailable. Smoothly switching to Cloud HTTP Sync mode.');
          this.isFallbackMode = true;
          this.isConnected = true;
          this.connectionMode = 'http_sync';
          this.notifyStatus(true, 'http_sync');
          // Retry WebSocket quietly once after 60 seconds
          setTimeout(() => {
            this.isFallbackMode = false;
            this.reconnectAttempts = 0;
            this.connect();
          }, 60000);
          return;
        }

        this.notifyStatus(false, 'connecting');
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        // Let onclose handle the reconnection cleanly without triggering duplicate closes
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isFallbackMode) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectAttempts++;
    const delay = Math.min(1500 * Math.pow(1.3, Math.min(this.reconnectAttempts, 8)), this.maxReconnectDelay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public on(eventType: string, cb: ListenerCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(cb);

    // Return unbind function
    return () => {
      this.listeners.get(eventType)?.delete(cb);
    };
  }

  public onStatusChange(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    cb(this.isConnected, this.connectionMode);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private emit(eventType: string, data: any): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(data);
        } catch (e) {
          console.error(`[WebSocket] Handler error for ${eventType}:`, e);
        }
      }
    }
  }

  private notifyStatus(connected: boolean, mode?: ConnectionMode): void {
    const finalMode = mode || this.connectionMode;
    for (const cb of this.statusListeners) {
      cb(connected, finalMode);
    }
  }

  public send(type: string, payload: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, ...payload }));
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getConnectionMode(): ConnectionMode {
    return this.connectionMode;
  }
}

export const wsManager = new AgriVaultWebSocketManager();
