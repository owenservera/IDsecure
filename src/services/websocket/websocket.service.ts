/**
 * WebSocket Service - Real-time bidirectional communication
 * Provides live search progress, notifications, and collaborative features
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';

export interface WSMessage {
  type: string;
  payload?: any;
  timestamp?: number;
  clientId?: string;
}

export interface WSSession {
  id: string;
  ws: WebSocket;
  userId?: string;
  investigations: string[];
  joinedAt: number;
  lastActivity: number;
}

export interface WSStats {
  connectedClients: number;
  activeInvestigations: number;
  messagesPerSecond: number;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSSession> = new Map();
  private messageCount = 0;
  private lastMessageTime = Date.now();

  /**
   * Initialize WebSocket server
   */
  init(port: number = 8080): void {
    try {
      this.wss = new WebSocketServer({ 
        port,
        perMessageDeflate: true,
        clientTracking: true,
      });

      this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
        this.handleConnection(ws, request);
      });

      this.wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
      });

      console.log(`WebSocket server started on port ${port}`);
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = this.generateClientId();
    const session: WSSession = {
      id: clientId,
      ws,
      investigations: [],
      joinedAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.clients.set(clientId, session);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      payload: { clientId, timestamp: Date.now() },
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // Handle pong (keep-alive)
    ws.on('pong', () => {
      session.lastActivity = Date.now();
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });

    console.log(`Client connected: ${clientId} (${this.clients.size} total)`);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(clientId: string, data: any): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      const session = this.clients.get(clientId);
      
      if (!session) return;

      session.lastActivity = Date.now();
      this.messageCount++;

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.payload);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.payload);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Message parse error:', error);
    }
  }

  /**
   * Handle subscription to investigation updates
   */
  private handleSubscribe(clientId: string, investigationId: string): void {
    const session = this.clients.get(clientId);
    if (!session || !investigationId) return;

    if (!session.investigations.includes(investigationId)) {
      session.investigations.push(investigationId);
    }

    this.sendToClient(clientId, {
      type: 'subscribed',
      payload: { investigationId },
    });
  }

  /**
   * Handle unsubscription from investigation updates
   */
  private handleUnsubscribe(clientId: string, investigationId: string): void {
    const session = this.clients.get(clientId);
    if (!session) return;

    session.investigations = session.investigations.filter(id => id !== investigationId);

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      payload: { investigationId },
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`Client disconnected: ${clientId} (${this.clients.size} remaining)`);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: WSMessage): boolean {
    const session = this.clients.get(clientId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      session.ws.send(JSON.stringify({
        ...message,
        timestamp: message.timestamp || Date.now(),
      }));
      return true;
    } catch (error) {
      console.error(`Failed to send to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all clients subscribed to an investigation
   */
  broadcastToInvestigation(investigationId: string, message: WSMessage): number {
    let sentCount = 0;

    for (const [clientId, session] of this.clients.entries()) {
      if (session.investigations.includes(investigationId)) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WSMessage): number {
    let sentCount = 0;

    for (const [clientId] of this.clients.entries()) {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send search progress update
   */
  sendSearchProgress(investigationId: string, progress: {
    stage: number;
    name: string;
    percentage: number;
    profilesFound: number;
  }): void {
    this.broadcastToInvestigation(investigationId, {
      type: 'search:progress',
      payload: progress,
    });
  }

  /**
   * Send new search results
   */
  sendSearchResults(investigationId: string, results: any[]): void {
    this.broadcastToInvestigation(investigationId, {
      type: 'search:results',
      payload: { results, count: results.length },
    });
  }

  /**
   * Send search completion
   */
  sendSearchComplete(investigationId: string, stats: any): void {
    this.broadcastToInvestigation(investigationId, {
      type: 'search:complete',
      payload: stats,
    });
  }

  /**
   * Get WebSocket statistics
   */
  getStats(): WSStats {
    const now = Date.now();
    const elapsed = (now - this.lastMessageTime) / 1000;
    const messagesPerSecond = elapsed > 0 ? this.messageCount / elapsed : 0;

    // Reset counter every second
    if (elapsed >= 1) {
      this.messageCount = 0;
      this.lastMessageTime = now;
    }

    const activeInvestigations = new Set(
      Array.from(this.clients.values())
        .flatMap(s => s.investigations)
    ).size;

    return {
      connectedClients: this.clients.size,
      activeInvestigations,
      messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
    };
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.wss) {
      this.wss.close(() => {
        console.log('WebSocket server closed');
      });
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check
   */
  healthCheck(): boolean {
    return this.wss !== null;
  }
}

// Singleton instance
export const wsService = new WebSocketService();

// Middleware helper for Next.js API routes
export function createWSHandler() {
  return {
    subscribe: (investigationId: string) => ({ investigationId }),
    broadcast: (type: string, payload: any) => wsService.broadcast({ type, payload }),
    sendProgress: (investigationId: string, progress: any) => 
      wsService.sendSearchProgress(investigationId, progress),
    sendResults: (investigationId: string, results: any[]) => 
      wsService.sendSearchResults(investigationId, results),
    sendComplete: (investigationId: string, stats: any) => 
      wsService.sendSearchComplete(investigationId, stats),
  };
}
