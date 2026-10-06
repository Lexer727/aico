import React from 'react';
import { WebSocketStatus } from '../../context/WebSocketContext';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusBannerProps {
  status: WebSocketStatus;
  onReconnect: () => void;
}

// @implements spec-ft-core-webui-shell::REQ-009
// @implements spec-ft-core-webui-shell::REQ-014
export const ConnectionStatusBanner: React.FC<ConnectionStatusBannerProps> = ({
  status,
  onReconnect,
}) => {
  const getBadge = () => {
    switch (status) {
      case WebSocketStatus.Connected:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 rounded-full">
            <Wifi className="w-3.5 h-3.5" />
            <span>Connected</span>
          </div>
        );
      case WebSocketStatus.Reconnecting:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-400 bg-amber-950/60 border border-amber-800 rounded-full">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Reconnecting...</span>
          </div>
        );
      case WebSocketStatus.Offline:
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-rose-400 bg-rose-950/60 border border-rose-800 rounded-full">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
            <button
              onClick={onReconnect}
              className="ml-1 px-1.5 py-0.5 text-xs bg-rose-800/80 hover:bg-rose-700 text-white rounded transition-colors"
            >
              Reconnect
            </button>
          </div>
        );
    }
  };

  return <div className="inline-flex items-center">{getBadge()}</div>;
};
