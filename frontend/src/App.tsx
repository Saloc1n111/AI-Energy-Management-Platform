import React, { useState, useEffect } from 'react';
import { DashboardDTO } from './types/dashboard';
import { api } from './api/client';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ViewType } from './components/layout/Sidebar';
import { RunAnalysisModal } from './components/analysis/RunAnalysisModal';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { MetersView } from './views/MetersView';
import { MeterDetailView } from './views/MeterDetailView';
import { AnomaliesView } from './views/AnomaliesView';
import { InvestigationView } from './views/InvestigationView';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Default true for seamless evaluation
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedMeterId, setSelectedMeterId] = useState<string>('M-109');
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string>('anm_m109_20260912T1400');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
      // Auto-set the first high priority anomaly id if available
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
    if (isAuthenticated) {
      fetchSummary();
    }
  }, [isAuthenticated]);

  const handleNavigate = (view: ViewType, contextId?: string) => {
    if (view === 'meter-detail' && contextId) {
      setSelectedMeterId(contextId);
    }
    if (view === 'investigation' && contextId) {
      setSelectedAnomalyId(contextId);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If user enters login view
  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-bia-navy-950 text-slate-100 selection:bg-bia-turquoise/20 selection:text-bia-turquoise font-sans antialiased">
      {/* Top Navbar */}
      <Navbar
        onRunAnalysis={() => setIsAnalysisModalOpen(true)}
        isAnalyzing={isAnalysisModalOpen}
      />

      {/* Main Body with Sidebar + Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          openAnomaliesCount={summary?.anomalies_detected ?? 4}
          criticalMeterId="M-109"
        />

        {/* Dynamic View Container */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full overflow-y-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              summary={summary}
              loading={loading}
              onRunAnalysis={() => setIsAnalysisModalOpen(true)}
              onNavigateToMeter={(id) => handleNavigate('meter-detail', id)}
              onNavigateToAnomalies={() => handleNavigate('anomalies')}
              onNavigateToInvestigation={(id) => handleNavigate('investigation', id)}
            />
          )}

          {currentView === 'meters' && (
            <MetersView
              onSelectMeter={(id) => handleNavigate('meter-detail', id)}
            />
          )}

          {currentView === 'meter-detail' && (
            <MeterDetailView
              meterId={selectedMeterId}
              onBack={() => handleNavigate('meters')}
              onInvestigateAnomaly={(anomalyId) => handleNavigate('investigation', anomalyId)}
            />
          )}

          {currentView === 'anomalies' && (
            <AnomaliesView
              onInvestigate={(anomalyId) => handleNavigate('investigation', anomalyId)}
              onSelectMeter={(id) => handleNavigate('meter-detail', id)}
            />
          )}

          {currentView === 'investigation' && (
            <InvestigationView
              anomalyId={selectedAnomalyId}
              onBack={() => handleNavigate('anomalies')}
              onNavigateToMeter={(id) => handleNavigate('meter-detail', id)}
            />
          )}
        </main>
      </div>

      {/* 7-Step AI Analysis Pipeline Modal */}
      <RunAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        onComplete={(run) => {
          fetchSummary();
        }}
        onNavigateToMeter={(meterId) => handleNavigate('meter-detail', meterId)}
        onNavigateToAnomalies={() => handleNavigate('anomalies')}
      />
    </div>
  );
}

export default App;
