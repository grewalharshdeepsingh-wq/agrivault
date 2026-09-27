type ListenerCallback = (data: any) => void;

class AgriVaultWebSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<ListenerCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private isConnecting = false;
  private isConnected = false;
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;

  constructor() {
    this.connect();
  }

  public connect(): void {
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyStatus(true);
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
        this.notifyStatus(false);
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

  public onStatusChange(cb: (connected: boolean) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.isConnected);
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

  private notifyStatus(connected: boolean): void {
    for (const cb of this.statusListeners) {
      cb(connected);
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
}

export const wsManager = new AgriVaultWebSocketManager();
