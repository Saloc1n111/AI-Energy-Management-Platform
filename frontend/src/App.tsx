import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardDTO } from './types/dashboard';
import { api, getStoredToken, getStoredUser } from './api/client';
import { User } from './types/auth';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ViewType } from './components/layout/Sidebar';
import { RunAnalysisModal } from './components/analysis/RunAnalysisModal';
import { AICopilotDrawer, CopilotContext } from './components/copilot/AICopilotDrawer';
import { TechnicalVisitModal } from './components/modals/TechnicalVisitModal';
import { AlertDiagnosisDrawer } from './components/dashboard/AlertDiagnosisDrawer';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { MetersView } from './views/MetersView';
import { MeterDetailView } from './views/MeterDetailView';
import { AnomaliesView } from './views/AnomaliesView';
import { InvestigationView } from './views/InvestigationView';
import { sanitizeMeterId } from './lib/utils';

interface MeterDetailWrapperProps {
  onBack: () => void;
  onInvestigateAnomaly: (id: string) => void;
  onRunAnalysis: () => void;
  onAnalysisComplete: () => void;
  onAskAI: (ctx: CopilotContext) => void;
  onRequestTechnicalVisit: (meterId: string) => void;
  selectedMeterId: string;
}

function MeterDetailWrapper(props: MeterDetailWrapperProps) {
  const { meterId } = useParams<{ meterId: string }>();
  const navigate = useNavigate();
  const isInvalid =
    !meterId || meterId === 'production-summary' || meterId.toLowerCase().includes('production-summary');
  const validId = isInvalid
    ? props.selectedMeterId && props.selectedMeterId !== 'production-summary'
      ? props.selectedMeterId
      : 'M-109'
    : meterId;

  useEffect(() => {
    if (isInvalid) {
      navigate(`/meters/${validId}`, { replace: true });
    }
  }, [isInvalid, validId, navigate]);

  return <MeterDetailView {...props} meterId={validId} />;
}

interface InvestigationWrapperProps {
  onBack: () => void;
  onNavigateToMeter: (meterId: string) => void;
  onAskAI: (ctx: CopilotContext) => void;
  onRequestTechnicalVisit: (meterId: string) => void;
  selectedAnomalyId: string;
}

function InvestigationWrapper(props: InvestigationWrapperProps) {
  const { anomalyId } = useParams<{ anomalyId: string }>();
  return <InvestigationView {...props} anomalyId={anomalyId || props.selectedAnomalyId || ''} />;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getStoredToken());
  const [selectedMeterId, setSelectedMeterId] = useState<string>('M-101');
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string>('');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotContext, setCopilotContext] = useState<CopilotContext | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [visitMeterId, setVisitMeterId] = useState('M-101');
  const [summary, setSummary] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDiagnosisDrawerOpen, setIsDiagnosisDrawerOpen] = useState(false);
  const [diagnosisMeterId, setDiagnosisMeterId] = useState('M-101');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bia_sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bia_sidebar_pinned');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainContainerRef = useRef<HTMLElement>(null);

  // Derive current view from URL route
  const currentView: ViewType = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/meters/') && path !== '/meters') return 'meter-detail';
    if (path === '/meters') return 'meters';
    if (path.startsWith('/anomalies/') && path !== '/anomalies') return 'investigation';
    if (path === '/anomalies') return 'anomalies';
    return 'dashboard';
  }, [location.pathname]);

  const handleResetRef = useRef<() => void>(() => {});

  // Keyboard shortcuts:
  // - Ctrl+B / Cmd+B: toggle sidebar
  // - Alt+R: reset demo to clean state
  // - Escape: collapse unpinned sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      } else if (e.key === 'Escape') {
        if (!isSidebarCollapsed && !isSidebarPinned) {
          setIsSidebarCollapsed(true);
          try {
            localStorage.setItem('bia_sidebar_collapsed', 'true');
          } catch {}
        }
      } else if (!isInput && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleResetRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarCollapsed, isSidebarPinned]);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileMenuOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('bia_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  const handleTogglePin = () => {
    setIsSidebarPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bia_sidebar_pinned', String(next));
      } catch {}
      if (next) {
        setIsSidebarCollapsed(false);
        try {
          localStorage.setItem('bia_sidebar_collapsed', 'false');
        } catch {}
      }
      return next;
    });
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
      if (data.top_priority && data.top_priority.length > 0) {
        setSelectedAnomalyId(data.top_priority[0].id);
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchSummary();

    const interval = setInterval(() => {
      api.getDashboardSummary()
        .then((data) => {
          setSummary(data);
        })
        .catch(() => {});
    }, 4000);

    const handleAnalysisCompleted = () => {
      fetchSummary();
    };
    window.addEventListener('bia:analysis-completed', handleAnalysisCompleted);

    return () => {
      clearInterval(interval);
      window.removeEventListener('bia:analysis-completed', handleAnalysisCompleted);
    };
  }, [isAuthenticated]);

  const openAnomaliesCount = summary?.anomalies_detected !== undefined
    ? summary.anomalies_detected
    : (summary?.top_priority?.length ?? 0);

  const handleResetAnalysis = async () => {
    try {
      await api.resetAnalysis();
      await fetchSummary();
      window.dispatchEvent(new CustomEvent('bia:analysis-completed'));
      navigate('/dashboard');
    } catch (err) {
      console.error('Error resetting analysis:', err);
    }
  };
  handleResetRef.current = handleResetAnalysis;

  const handleNavigate = (view: ViewType, contextId?: string) => {
    if (view === 'meter-detail' && contextId) {
      const cleanId = sanitizeMeterId(contextId, selectedMeterId || 'M-109');
      setSelectedMeterId(cleanId);
      navigate(`/meters/${cleanId}`);
    } else if (view === 'meters') {
      navigate('/meters');
    } else if (view === 'investigation' && contextId) {
      setSelectedAnomalyId(contextId);
      navigate(`/anomalies/${contextId}`);
    } else if (view === 'anomalies') {
      navigate('/anomalies');
    } else {
      fetchSummary();
      navigate('/dashboard');
    }
    setIsMobileMenuOpen(false);
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAskAI = (ctx: CopilotContext) => {
    setCopilotContext(ctx);
    setIsCopilotOpen(true);
  };

  const handleRequestTechnicalVisit = (meterId: string) => {
    setVisitMeterId(meterId);
    setIsVisitModalOpen(true);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const isPipelineRunning = Boolean(
    isAnalysisModalOpen ||
    summary?.last_analysis?.status === 'RUNNING' ||
    summary?.last_analysis?.status === 'IN_PROGRESS' ||
    summary?.last_analysis?.status === 'PENDING'
  );

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 text-slate-900 dark:bg-bia-navy-950 dark:text-slate-100 selection:bg-bia-turquoise/20 selection:text-bia-turquoise font-sans antialiased transition-colors duration-200 overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        onRunAnalysis={() => setIsAnalysisModalOpen(true)}
        isAnalyzing={isPipelineRunning}
        onOpenCopilot={() =>
          handleAskAI({
            type: 'general',
            id: 'global_navbar',
            title: 'Asesoría Integral de Energía Bia',
          })
        }
        currentUser={currentUser}
        onLogout={handleLogout}
        onToggleSidebar={handleToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
      />

      {/* Main Body with Sidebar + Content Area */}
      <div className="flex-1 flex relative min-h-0 w-full overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          openAnomaliesCount={openAnomaliesCount}
          selectedMeterId={selectedMeterId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          isPinned={isSidebarPinned}
          onTogglePin={handleTogglePin}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Dynamic View Container */}
        <main
          ref={mainContainerRef}
          className="flex-1 overflow-y-auto min-h-0 w-full"
        >
          <div className="p-4 sm:p-6 lg:p-7 max-w-7xl mx-auto w-full pb-16 md:pb-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <DashboardView
                    summary={summary}
                    loading={loading}
                    onRunAnalysis={() => setIsAnalysisModalOpen(true)}
                    onResetAnalysis={handleResetAnalysis}
                    onNavigateToMeter={(id: string) => handleNavigate('meter-detail', id)}
                    onNavigateToAnomalies={() => handleNavigate('anomalies')}
                    onNavigateToInvestigation={(id: string) => handleNavigate('investigation', id)}
                    onAskAI={handleAskAI}
                    onRequestTechnicalVisit={handleRequestTechnicalVisit}
                    onOpenDiagnosisDrawer={(meterId) => {
                      if (meterId) setDiagnosisMeterId(meterId);
                      setIsDiagnosisDrawerOpen(true);
                    }}
                  />
                }
              />
              <Route
                path="/meters"
                element={
                  <MetersView
                    onSelectMeter={(id: string) => handleNavigate('meter-detail', id)}
                  />
                }
              />
              <Route
                path="/meters/:meterId"
                element={
                  <MeterDetailWrapper
                    onBack={() => handleNavigate('dashboard')}
                    onInvestigateAnomaly={(anomalyId: string) => handleNavigate('investigation', anomalyId)}
                    onRunAnalysis={() => setIsAnalysisModalOpen(true)}
                    onAnalysisComplete={fetchSummary}
                    onAskAI={handleAskAI}
                    onRequestTechnicalVisit={handleRequestTechnicalVisit}
                    selectedMeterId={selectedMeterId}
                  />
                }
              />
              <Route
                path="/anomalies"
                element={
                  <AnomaliesView
                    onInvestigate={(id: string) => handleNavigate('investigation', id)}
                    onSelectMeter={(meterId: string) => handleNavigate('meter-detail', meterId)}
                    onAskAI={handleAskAI}
                    onRequestTechnicalVisit={handleRequestTechnicalVisit}
                  />
                }
              />
              <Route
                path="/anomalies/:anomalyId"
                element={
                  <InvestigationWrapper
                    onBack={() => handleNavigate('anomalies')}
                    onNavigateToMeter={(id: string) => handleNavigate('meter-detail', id)}
                    onAskAI={handleAskAI}
                    onRequestTechnicalVisit={handleRequestTechnicalVisit}
                    selectedAnomalyId={selectedAnomalyId}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Analysis Pipeline Modal */}
      <RunAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        onComplete={() => {
          fetchSummary();
        }}
      />

      {/* AI Copilot Drawer */}
      <AICopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        context={copilotContext}
        currentUser={currentUser}
        onRequestTechnicalVisit={handleRequestTechnicalVisit}
        onNavigateToMeter={(meterId) => handleNavigate('meter-detail', meterId)}
      />

      {/* Technical Visit Request Modal */}
      <TechnicalVisitModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        defaultMeterId={visitMeterId}
        onSuccess={() => {
          fetchSummary();
        }}
      />

      {/* Interactive Alert Diagnosis Suite Drawer */}
      <AlertDiagnosisDrawer
        isOpen={isDiagnosisDrawerOpen}
        onClose={() => setIsDiagnosisDrawerOpen(false)}
        selectedMeterId={diagnosisMeterId}
        selectedAnomalyId={selectedAnomalyId}
        anomalies={summary?.top_priority}
        onRequestTechnicalVisit={handleRequestTechnicalVisit}
        onAskAI={handleAskAI}
        onNavigateToInvestigation={(anomalyId) => {
          setIsDiagnosisDrawerOpen(false);
          handleNavigate('investigation', anomalyId);
        }}
        onNavigateToMeter={(meterId) => {
          setIsDiagnosisDrawerOpen(false);
          handleNavigate('meter-detail', meterId);
        }}
      />
    </div>
  );
}

export default App;
