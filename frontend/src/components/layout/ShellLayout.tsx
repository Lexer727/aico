import React, { useState } from 'react';
import { Menu, ChevronDown, ChevronRight, Folder, FileCode, BookOpen, Layers } from 'lucide-react';

interface ShellLayoutProps {
  children: React.ReactNode;
  isMobile?: boolean;
}

// @implements SPEC-CORE-006::REQ-001
// @implements SPEC-CORE-006::REQ-002
// @implements SPEC-CORE-006::REQ-008
// @implements SPEC-CORE-006::REQ-013
export const ShellLayout: React.FC<ShellLayoutProps> = ({
  children,
  isMobile = false,
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    epics: true,
    specifications: true,
    code: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800 text-zinc-300 select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 font-bold text-zinc-100 text-sm tracking-wide">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span>AICO WORKSPACE</span>
        </div>
      </div>

      {/* Accordion Workspace Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
        {/* Epics Accordion */}
        <div>
          <button
            data-testid="toggle-epics"
            onClick={() => toggleSection('epics')}
            className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-800/60 font-medium text-zinc-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Epics</span>
            </div>
            {openSections.epics ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>
          {openSections.epics && (
            <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
              <div className="py-1 px-2 hover:bg-zinc-800/40 rounded cursor-pointer">
                001-aico-core
              </div>
            </div>
          )}
        </div>

        {/* Specifications Accordion */}
        <div>
          <button
            data-testid="toggle-specifications"
            onClick={() => toggleSection('specifications')}
            className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-800/60 font-medium text-zinc-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Specifications</span>
            </div>
            {openSections.specifications ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>
          {openSections.specifications && (
            <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
              <div className="py-1 px-2 hover:bg-zinc-800/40 rounded cursor-pointer">
                SPEC-CORE-001 Host Runtime
              </div>
              <div className="py-1 px-2 hover:bg-zinc-800/40 rounded cursor-pointer">
                SPEC-CORE-006 WebUI Shell
              </div>
            </div>
          )}
        </div>

        {/* Code Files Accordion */}
        <div>
          <button
            data-testid="toggle-code"
            onClick={() => toggleSection('code')}
            className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-800/60 font-medium text-zinc-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>Code</span>
            </div>
            {openSections.code ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>
          {openSections.code && (
            <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
              <div className="flex items-center gap-1.5 py-1 px-2 hover:bg-zinc-800/40 rounded cursor-pointer">
                <Folder className="w-3 h-3 text-zinc-500" />
                <span>crates/aico-server</span>
              </div>
              <div className="flex items-center gap-1.5 py-1 px-2 hover:bg-zinc-800/40 rounded cursor-pointer">
                <Folder className="w-3 h-3 text-zinc-500" />
                <span>frontend/src</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Desktop Full-Height Sidebar */}
      {!isMobile && (
        <aside
          data-testid="left-sidebar"
          className="h-screen w-64 flex-shrink-0 z-20 flex flex-col"
        >
          {renderNavContent()}
        </aside>
      )}

      {/* Mobile Drawer Trigger & Slide-Over */}
      {isMobile && (
        <>
          <button
            data-testid="mobile-drawer-toggle"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-zinc-800 text-zinc-100 shadow-lg border border-zinc-700"
          >
            <Menu className="w-5 h-5" />
          </button>

          {mobileDrawerOpen && (
            <div
              data-testid="mobile-drawer"
              className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <div
                className="w-72 h-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {renderNavContent()}
              </div>
            </div>
          )}
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-zinc-950 relative">
        {children}
      </main>
    </div>
  );
};
