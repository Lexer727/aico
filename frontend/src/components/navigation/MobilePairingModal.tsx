import React, { useState, useEffect } from 'react';
import { X, QrCode, Copy, Check, Smartphone, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';

export interface MobilePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  windowId: string;
}

export interface LanCandidate {
  ip: string;
  interface_name: string;
  is_preferred: boolean;
}

interface PairingData {
  lan_ip: string;
  port: number;
  token: string;
  pairing_url: string;
  candidate_ips?: LanCandidate[];
}

// @implements ft-core-webui-shell::TASK-CORE-006-17::REQ-019
// @implements spec-ft-core-lan-ip-vpn-pairing-resolver::TASK-CORE-019-3::REQ-005
export const MobilePairingModal: React.FC<MobilePairingModalProps> = ({
  isOpen,
  onClose,
  windowId,
}) => {
  const [pairingData, setPairingData] = useState<PairingData | null>(null);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    fetch('/api/v1/auth/pairing')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: PairingData) => {
        if (!mounted) return;
        setPairingData(data);
        setSelectedIp(data.lan_ip || '');
      })
      .catch((err) => {
        if (mounted) {
          setError(`Could not fetch pairing URL: ${err.message}`);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const fullUrl = React.useMemo(() => {
    if (!pairingData) return '';
    const hostIp = selectedIp || pairingData.lan_ip;
    const baseUrl = `http://${hostIp}:${pairingData.port}/?token=${encodeURIComponent(pairingData.token)}`;
    return `${baseUrl}&win=${encodeURIComponent(windowId)}`;
  }, [pairingData, selectedIp, windowId]);

  useEffect(() => {
    if (!fullUrl) return;
    let mounted = true;

    QRCode.toString(fullUrl, {
      type: 'svg',
      margin: 1,
      width: 220,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((svg) => {
        if (mounted) {
          setQrSvg(svg);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Failed to generate QR code');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fullUrl]);

  if (!isOpen) return null;

  const getDisplayName = (candidate: LanCandidate) => {
    if (candidate.interface_name && !candidate.interface_name.startsWith('{')) {
      return candidate.interface_name;
    }
    if (candidate.ip.startsWith('192.168.')) return 'Local Wi-Fi / Ethernet';
    if (candidate.ip.startsWith('10.')) return 'Local Network (10.x)';
    if (candidate.ip.startsWith('172.')) return 'Local Network (172.x)';
    return 'Network Adapter';
  };

  const handleCopy = () => {
    if (!fullUrl) return;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="mobile-pairing-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Pair Mobile Companion</h2>
              <p className="text-[11px] text-zinc-400">Connect your phone to this desktop window</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-pairing-modal-btn"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center space-y-5">
          {loading && (
            <div className="w-56 h-56 flex items-center justify-center bg-zinc-950/50 rounded-lg border border-zinc-800">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="w-full p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center">
              {error}
            </div>
          )}

          {!loading && !error && qrSvg && (
            <div className="flex flex-col items-center space-y-2">
              <div
                data-testid="qr-code-svg-container"
                className="p-3 bg-white rounded-xl shadow-md flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Target Window: <span className="text-zinc-200 font-semibold">{windowId}</span>
              </div>
            </div>
          )}

          {pairingData?.candidate_ips && pairingData.candidate_ips.length > 1 && (
            <div className="w-full space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400 font-medium">
                <span>Network Interface (LAN):</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {(() => {
                    const found = pairingData.candidate_ips.find((c) => c.ip === selectedIp);
                    return found ? getDisplayName(found) : '';
                  })()}
                </span>
              </div>
              <select
                data-testid="network-interface-select"
                value={selectedIp}
                onChange={(e) => setSelectedIp(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {pairingData.candidate_ips.map((candidate) => (
                  <option key={candidate.ip} value={candidate.ip}>
                    {getDisplayName(candidate)} ({candidate.ip}) {candidate.is_preferred ? '★ Recommended' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full space-y-1.5 text-xs">
            <label className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              Pairing URL (LAN Wi-Fi)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                data-testid="pairing-url-input"
                value={fullUrl}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none select-all"
              />
              <button
                type="button"
                data-testid="copy-pairing-url-btn"
                onClick={handleCopy}
                title="Copy Pairing URL"
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="w-full p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
            <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3 text-indigo-400" />
              How it works
            </div>
            <p>
              1. Ensure your mobile phone is on the same Wi-Fi / local network.
            </p>
            <p>
              2. Open your phone camera or QR scanner and point it at the code above.
            </p>
            <p>
              3. The mobile companion will mirror this desktop window's main view and terminal tabs in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
