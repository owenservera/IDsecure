'use client';

import { useState, useCallback, useRef } from 'react';
import { useSocialSearch } from '@/hooks/use-social-search';
import { SearchForm } from '@/components/SearchForm';
import { ResultsList } from '@/components/ResultsList';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { RiskAssessmentView } from '@/components/RiskAssessmentView';
import { InvestigationHistory } from '@/components/InvestigationHistory';
import { SocialGraph } from '@/components/SocialGraph';
import { IdentityTimeline } from '@/components/IdentityTimeline';
import { ForensicsView } from '@/components/ForensicsView';
import { StylometryWidget } from '@/components/StylometryWidget';
import { MCPToolsView } from '@/components/MCPToolsView';
import { MultiImageUploader, UploadedImage, ImageAnalysisResult } from '@/components/MultiImageUploader';
import { ImageAnalysisResults } from '@/components/ImageAnalysisResults';
import { UserHints } from '@/lib/types';
import { Atom, Sparkles, BarChart3, Network, Shield, Radar, Loader2, BrainCircuit, Calendar, ScanLine, LogOut, FileText, Box, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from 'next-auth/react';

export default function SocialIntelligenceEngine() {
  const { data: session } = useSession();
  const [activeView, setActiveView] = useState<'search' | 'analytics' | 'graph' | 'risk' | 'forensics' | 'mcp' | 'images'>('search');

  // Search state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Multi-image upload state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false);
  const [crossImageInsights, setCrossImageInsights] = useState<any>(null);

  const [hints, setHints] = useState<UserHints>({
    age: '', job: '', company: '', location: '',
    previousLocations: [], education: '', interests: [],
    travelHistory: [], socialCircles: [], aliases: [], languages: [],
  });

  const [powerModeEnabled, setPowerModeEnabled] = useState(false);
  const [stageCount, setStageCount] = useState([5]);
  const [aggressiveMode, setAggressiveMode] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState([40]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    mutate: executeSearch,
    isPending: isSearching,
    results,
    searchProgress,
    currentStage,
    currentStageName,
    statisticalAnalysis,
    searchStats,
    stageResults,
    breachResults,
    riskAssessment,
    forensicResults,
    stylometryAnalysis,
    darkWebReport,
    isAnalyzingSOTA,
    loadInvestigation
  } = useSocialSearch();

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleGenerateReport = async (format: 'pdf' | 'markdown') => {
    setIsGeneratingReport(true);
    try {
      const response = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: { name, email, phone, username },
          results,
          riskAssessment,
          breachResults,
          forensicResults,
          format
        })
      });

      if (format === 'pdf') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `legal_brief_${name || 'investigation'}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const data = await response.json();
        const blob = new Blob([data.reportContent], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `legal_brief_${name || 'investigation'}.md`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (error) {
      console.error('Report generation failed', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        const base64 = result.split(',')[1];
        setImageBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleAnalyzeImages = useCallback(async (images: UploadedImage[]) => {
    if (images.length === 0) return;

    setIsAnalyzingImages(true);
    setCrossImageInsights(null);

    try {
      // Update status to analyzing
      setUploadedImages(prev => prev.map(img => ({
        ...img,
        status: 'analyzing' as const
      })));

      const response = await fetch('/api/analysis/image-data-extraction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map(img => ({
            base64: img.base64,
            filename: img.file.name
          }))
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update images with analysis results
        setUploadedImages(prev => prev.map(img => {
          const result = data.results.find((r: any) => r.filename === img.file.name);
          if (result) {
            return {
              ...img,
              status: 'analyzed' as const,
              analysis: result.analysis as ImageAnalysisResult
            };
          }
          return img;
        }));

        // Set cross-image insights if available
        if (data.crossImageInsights) {
          setCrossImageInsights(data.crossImageInsights);
        }
      }
    } catch (error) {
      console.error('Image analysis failed:', error);
      setUploadedImages(prev => prev.map(img => ({
        ...img,
        status: 'error' as const
      })));
    } finally {
      setIsAnalyzingImages(false);
    }
  }, []);

  const handleSearch = () => {
    executeSearch({
      name, email, phone, username,
      imageBase64: imageBase64 || undefined,
      hints,
      powerMode: powerModeEnabled,
      stages: stageCount[0],
      aggressive: aggressiveMode,
      aiRefinement: true,
      confidenceThreshold: confidenceThreshold[0]
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl shadow-lg">
                <Atom className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  Social Intelligence Engine
                </h1>
                <p className="text-xs text-muted-foreground">Logged in as {session?.user?.name || 'Lead Analyst'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {results.length > 0 && (
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={isGeneratingReport}
                    onClick={() => handleGenerateReport('markdown')}
                    className="text-[10px] h-7 px-2 border-violet-200 text-violet-700"
                  >
                    MD Brief
                  </Button>
                  <Button 
                    size="sm" 
                    variant="default" 
                    disabled={isGeneratingReport}
                    onClick={() => handleGenerateReport('pdf')}
                    className="text-[10px] h-7 px-2 bg-violet-600"
                  >
                    {isGeneratingReport ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                    Legal PDF
                  </Button>
                </div>
              )}
              {isAnalyzingSOTA && (
                <Badge variant="outline" className="gap-1 bg-violet-50 text-violet-700 border-violet-200 animate-pulse">
                  <BrainCircuit className="h-3 w-3" />
                  Analyzing SOTA...
                </Badge>
              )}
              <Button size="sm" variant="ghost" onClick={() => signOut()} className="text-xs text-muted-foreground hover:text-red-600">
                <LogOut className="h-3 w-3 mr-1" /> Logout
              </Button>
            </div>
          </div>

          <div className="flex gap-1 mt-2">
            <Button size="sm" variant={activeView === 'search' ? 'default' : 'ghost'} onClick={() => setActiveView('search')} className="text-xs">
              <Radar className="h-3 w-3 mr-1" /> Search
            </Button>
            <Button size="sm" variant={activeView === 'analytics' ? 'default' : 'ghost'} onClick={() => setActiveView('analytics')} className="text-xs">
              <BarChart3 className="h-3 w-3 mr-1" /> Analytics
            </Button>
            <Button size="sm" variant={activeView === 'graph' ? 'default' : 'ghost'} onClick={() => setActiveView('graph')} className="text-xs">
              <Network className="h-3 w-3 mr-1" /> Graph
            </Button>
            <Button size="sm" variant={activeView === 'risk' ? 'default' : 'ghost'} onClick={() => setActiveView('risk')} className="text-xs">
              <Shield className="h-3 w-3 mr-1" /> Risk
            </Button>
            <Button size="sm" variant={activeView === 'forensics' ? 'default' : 'ghost'} onClick={() => setActiveView('forensics')} className="text-xs">
              <ScanLine className="h-3 w-3 mr-1" /> Forensics
            </Button>
            <Button size="sm" variant={activeView === 'images' ? 'default' : 'ghost'} onClick={() => setActiveView('images')} className="text-xs">
              <Image className="h-3 w-3 mr-1" /> Images
            </Button>
            <Button size="sm" variant={activeView === 'mcp' ? 'default' : 'ghost'} onClick={() => setActiveView('mcp')} className="text-xs">
              <Box className="h-3 w-3 mr-1" /> MCP Tools
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        {isSearching && (
          <Card className="mb-4 border-violet-200 bg-violet-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                  <span className="font-medium text-sm">Iteration {currentStage}: {currentStageName}</span>
                </div>
                <span className="text-sm font-bold text-violet-600">{searchProgress}%</span>
              </div>
              <Progress value={searchProgress} className="h-2" />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-1 space-y-4">
            <SearchForm
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
              username={username} setUsername={setUsername}
              imagePreview={imagePreview} handleImageUpload={handleImageUpload}
              resetImage={() => { setImagePreview(null); setImageBase64(null); }}
              fileInputRef={fileInputRef}
              hints={hints} setHints={setHints}
              powerModeEnabled={powerModeEnabled} setPowerModeEnabled={setPowerModeEnabled}
              stageCount={stageCount} setStageCount={setStageCount}
              aggressiveMode={aggressiveMode} setAggressiveMode={setAggressiveMode}
              confidenceThreshold={confidenceThreshold} setConfidenceThreshold={setConfidenceThreshold}
              onSearch={handleSearch}
              isSearching={isSearching}
              currentStage={currentStage}
              totalStages={stageCount[0]}
            />
            
            <InvestigationHistory onSelect={(id) => {
              loadInvestigation(id);
              setActiveView('search');
            }} />
          </div>

          <div className="xl:col-span-3">
            {activeView === 'search' && (
              <div className="space-y-4">
                <ResultsList
                  results={results}
                  isSearching={isSearching}
                  onGenerateEngagement={() => {}}
                  isGeneratingEngagement={false}
                />
              </div>
            )}
            
            {activeView === 'analytics' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <AnalyticsDashboard results={results} analysis={statisticalAnalysis} />
                  <StylometryWidget analysis={stylometryAnalysis} />
                </div>
                <div className="lg:col-span-1">
                  <IdentityTimeline results={results} />
                </div>
              </div>
            )}

            {activeView === 'risk' && (
              <RiskAssessmentView risk={riskAssessment} breaches={breachResults} darkWeb={darkWebReport} />
            )}

            {activeView === 'graph' && (
              <div className="h-[600px]">
                <SocialGraph results={results} subjectName={name || username || 'Subject'} />
              </div>
            )}

            {activeView === 'forensics' && (
              <ForensicsView forensics={forensicResults} />
            )}

            {activeView === 'images' && (
              <div className="space-y-4">
                <MultiImageUploader
                  images={uploadedImages}
                  onImagesChange={setUploadedImages}
                  onAnalyze={handleAnalyzeImages}
                  isAnalyzing={isAnalyzingImages}
                />
                <ImageAnalysisResults
                  images={uploadedImages}
                  crossImageInsights={crossImageInsights}
                />
              </div>
            )}

            {activeView === 'mcp' && (
              <MCPToolsView />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
