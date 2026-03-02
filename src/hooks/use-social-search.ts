'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SearchResult, UserHints, StageResult, StatisticalAnalysis, SearchStats, BreachResult, RiskAssessment } from '@/lib/types';

interface PowerSearchParams {
  name?: string;
  email?: string;
  phone?: string;
  username?: string;
  imageBase64?: string;
  hints: UserHints;
  powerMode: boolean;
  stages: number;
  aggressive: boolean;
  aiRefinement: boolean;
  confidenceThreshold: number;
}

export function useSocialSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);
  const [statisticalAnalysis, setStatisticalAnalysis] = useState<StatisticalAnalysis | null>(null);
  const [searchStats, setSearchStats] = useState<SearchStats | null>(null);
  const [breachResults, setBreachResults] = useState<BreachResult | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [forensicResults, setForensicResults] = useState<any | null>(null);
  const [stylometryAnalysis, setStylometryAnalysis] = useState<any | null>(null);
  const [darkWebReport, setDarkWebReport] = useState<any | null>(null);
  const [isAnalyzingSOTA, setIsAnalyzingSOTA] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentStageName, setCurrentStageName] = useState('');

  const reset = useCallback(() => {
    setResults([]);
    setStageResults([]);
    setStatisticalAnalysis(null);
    setSearchStats(null);
    setBreachResults(null);
    setRiskAssessment(null);
    setForensicResults(null);
    setStylometryAnalysis(null);
    setDarkWebReport(null);
    setSearchProgress(0);
    setCurrentStage(0);
    setCurrentStageName('');
  }, []);

  const loadInvestigation = useCallback(async (id: string) => {
    reset();
    setIsAnalyzingSOTA(true);
    try {
      const response = await fetch(`/api/investigations/${id}`);
      const data = await response.json();
      
      if (data.success) {
        const inv = data.investigation;
        setResults(inv.results);
        if (inv.riskAssessment) {
          const factors = JSON.parse(inv.riskAssessment.factors);
          setStatisticalAnalysis(factors);
          setRiskAssessment({
            overallRiskLevel: inv.riskAssessment.riskLevel,
            riskScore: inv.riskAssessment.overallScore,
            credibilityScore: factors.verificationScore,
            riskFactors: factors.riskFactors || [],
            threatIndicators: factors.threatIndicators || []
          });
        }
        if (inv.breaches) {
          setBreachResults({
            overallRisk: inv.riskAssessment?.riskLevel || 'low',
            riskScore: inv.riskAssessment?.overallScore || 0,
            breachResults: inv.breaches
          });
        }
        setSearchStats({
          totalQueries: 0,
          platformsSearched: Array.from(new Set(inv.results.map((r: any) => r.platform))),
          crossReferences: 0,
          locationMatches: inv.results.filter((r: any) => r.location).length,
          highConfidenceMatches: inv.results.filter((r: any) => r.confidence >= 80).length,
          searchDuration: 0,
          stagesCompleted: Math.max(...inv.results.map((r: any) => r.stage)),
          totalStages: Math.max(...inv.results.map((r: any) => r.stage))
        });
      }
    } catch (error) {
      console.error('Load investigation error:', error);
    } finally {
      setIsAnalyzingSOTA(false);
    }
  }, [reset]);

  const runSOTAAnalysis = useCallback(async (currentResults: SearchResult[], params: PowerSearchParams) => {
    setIsAnalyzingSOTA(true);
    try {
      const promises: Promise<any>[] = [
        fetch('/api/analysis/breach-monitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: params.email, phone: params.phone, username: params.username, name: params.name })
        }).then(r => r.json()).then(data => data.success && setBreachResults(data)),

        fetch('/api/analysis/risk-scoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profiles: currentResults, searchQuery: { name: params.name, email: params.email, phone: params.phone, username: params.username, hints: params.hints } })
        }).then(r => r.json()).then(data => data.success && setRiskAssessment(data.riskAssessment)),

        fetch('/api/analysis/dark-web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: params.email, phone: params.phone, username: params.username })
        }).then(r => r.json()).then(data => data.success && setDarkWebReport(data.report))
      ];

      if (params.imageBase64) {
        promises.push(
          fetch('/api/analysis/image-forensics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: params.imageBase64, profiles: currentResults })
          }).then(r => r.json()).then(data => data.success && setForensicResults(data))
        );
      }

      if (currentResults.length >= 2) {
        promises.push(
          fetch('/api/analysis/stylometry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profiles: currentResults.slice(0, 10) })
          }).then(r => r.json()).then(data => data.success && setStylometryAnalysis(data.analysis))
        );
      }

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('SOTA analysis error:', error);
    } finally {
      setIsAnalyzingSOTA(false);
    }
  }, []);

  const searchMutation = useMutation({
    mutationFn: async (params: PowerSearchParams) => {
      reset();
      const response = await fetch('/api/search/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let latestResults: SearchResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'stage') {
                setCurrentStage(data.stage);
                setCurrentStageName(data.name);
                setSearchProgress(data.progress);
                setStageResults(prev => {
                  const updated = [...prev];
                  const existingIndex = updated.findIndex(s => s.stage === data.stage);
                  if (existingIndex >= 0) {
                    updated[existingIndex] = { ...updated[existingIndex], ...data };
                  } else {
                    updated.push(data);
                  }
                  return updated;
                });
              } else if (data.type === 'results') {
                setResults(prev => {
                  const newResults = data.results.filter(
                    (r: SearchResult) => !prev.some(p => p.url === r.url)
                  );
                  const combined = [...prev, ...newResults].sort((a, b) => b.confidence - a.confidence);
                  latestResults = combined;
                  return combined;
                });
              } else if (data.type === 'analysis') {
                setStatisticalAnalysis(data.analysis);
              } else if (data.type === 'complete') {
                setSearchStats(data.stats);
                setSearchProgress(100);
                runSOTAAnalysis(latestResults, params);
              }
            } catch (e) {
              console.error('SSE parse error', e);
            }
          }
        }
      }
      return true;
    },
  });

  return {
    ...searchMutation,
    results,
    stageResults,
    statisticalAnalysis,
    searchStats,
    breachResults,
    riskAssessment,
    forensicResults,
    stylometryAnalysis,
    darkWebReport,
    isAnalyzingSOTA,
    searchProgress,
    currentStage,
    currentStageName,
    reset,
    loadInvestigation,
  };
}
