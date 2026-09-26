type ListenerCallback = (data: any) => void;

class AgriVaultWebSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<ListenerCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private isConnecting = false;
  private isConnected = false;
  private statusListeners: Set<(connected: boolean) => void> = new Set();

  constructor() {
    this.connect();
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running in Vite dev server (port 3000), connect to ws proxy or localhost:4000
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyStatus(true);
        console.log('[WebSocket] Real-time link connected to AgriVault Hub');
      };

      this.socket.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type) {
            this.emit(packet.type, packet.data);
          }
        } catch {
          // ignore
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        this.socket?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    setTimeout(() => {
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
