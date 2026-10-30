// @implements spec-ft-distribution-update-check::TASK-DISTRIBUTION-006-2::REQ-002
import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';

export interface UpdateInfo {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  release_url: string | null;
  checked_at: string;
}

export const UPDATE_DISMISS_KEY = 'aico_dismissed_update_version';

export const UpdateBanner: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/v1/system/update')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch update status');
        return res.json();
      })
      .then((data: UpdateInfo) => {
        if (!isMounted) return;
        if (data && data.update_available && data.latest_version) {
          const storedDismissed = localStorage.getItem(UPDATE_DISMISS_KEY);
          if (storedDismissed === data.latest_version) {
            setDismissed(true);
          } else {
            setDismissed(false);
          }
          setUpdateInfo(data);
        } else {
          setUpdateInfo(null);
        }
      })
      .catch(() => {
        // Silently degrade on error (REQ-003)
        if (isMounted) setUpdateInfo(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = () => {
    if (updateInfo?.latest_version) {
      localStorage.setItem(UPDATE_DISMISS_KEY, updateInfo.latest_version);
    }
    setDismissed(true);
  };

  if (!updateInfo || !updateInfo.update_available || dismissed) {
    return null;
  }

  return (
    <div
      data-testid="update-banner"
      className="bg-indigo-950/80 border-b border-indigo-500/30 text-indigo-200 px-4 py-2 flex items-center justify-between text-xs z-20 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="w-4 h-4 text-indigo-400 animate-pulse flex-shrink-0" />
        <span>
          A new version of AICO is available:{' '}
          <span className="font-semibold text-white">v{updateInfo.latest_version}</span>{' '}
          (current: v{updateInfo.current_version})
        </span>
        {updateInfo.release_url && (
          <a
            href={updateInfo.release_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline text-indigo-300 hover:text-white font-medium"
          >
            View Release & Download
          </a>
        )}
      </div>
      <button
        data-testid="dismiss-update-banner"
        onClick={handleDismiss}
        className="text-zinc-400 hover:text-zinc-100 p-1 rounded hover:bg-zinc-800/60 transition-colors"
        title="Dismiss update banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
