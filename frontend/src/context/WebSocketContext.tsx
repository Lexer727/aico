import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export const WebSocketStatus = {
  Connected: 'connected',
  Reconnecting: 'reconnecting',
  Offline: 'offline',
} as const;

export type WebSocketStatus = (typeof WebSocketStatus)[keyof typeof WebSocketStatus];

interface WebSocketContextType {
  status: WebSocketStatus;
  reconnect: () => void;
  sendMessage: (topic: string, payload: unknown) => void;
  lastMessage: unknown | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  status: WebSocketStatus.Offline,
  reconnect: () => {},
  sendMessage: () => {},
  lastMessage: null,
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

// @implements SPEC-CORE-006::REQ-009
// @implements SPEC-CORE-006::REQ-014
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url,
}) => {
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.Offline);
  const [lastMessage, setLastMessage] = useState<unknown | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url || `${protocol}//${window.location.host}/ws`;

    try {
      setStatus(WebSocketStatus.Reconnecting);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus(WebSocketStatus.Connected);
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastMessage(parsed);
        } catch {
          setLastMessage(event.data);
        }
      };

      ws.onclose = () => {
        setStatus(WebSocketStatus.Offline);
        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        setStatus(WebSocketStatus.Offline);
        ws.close();
      };
    } catch {
      setStatus(WebSocketStatus.Offline);
    }
  }, [url]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  const sendMessage = useCallback((topic: string, payload: unknown) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ topic, payload }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ status, reconnect, sendMessage, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};
