export interface SearchResult {
  platform: string;
  url: string;
  title: string;
  snippet: string;
  confidence: number;
  profileImage?: string;
  location?: string;
  profession?: string;
  company?: string;
  education?: string;
  connections?: string;
  lastActive?: string;
  stage?: number;
  verified?: boolean;
  crossRefCount?: number;
}

export interface UserHints {
  age?: string;
  job?: string;
  company?: string;
  location?: string;
  previousLocations?: string[];
  education?: string;
  interests?: string[];
  travelHistory?: string[];
  socialCircles?: string[];
  aliases?: string[];
  languages?: string[];
}

export interface StatisticalAnalysis {
  overallConfidence: number;
  profileCorrelation: number;
  dataConsistency: number;
  verificationScore: number;
  networkAnalysis: {
    connections: number;
    mutualConnections: number;
    networkStrength: string;
  };
  timelineConsistency: number;
  geographicConsistency: number;
}

export interface StageResult {
  stage: number;
  name: string;
  status: 'pending' | 'running' | 'completed';
  profilesFound: number;
  crossRefsFound: number;
  confidence: number;
  duration: number;
  description: string;
}

export interface SearchStats {
  totalQueries: number;
  platformsSearched: string[];
  crossReferences: number;
  locationMatches: number;
  highConfidenceMatches: number;
  searchDuration: number;
  stagesCompleted: number;
  totalStages: number;
}

export interface BreachResult {
  overallRisk: string;
  riskScore: number;
  breachResults: Array<{
    source: string;
    breachType: string;
    severity: string;
    title: string;
    description: string;
    exposedData: string[];
  }>;
}

export interface RiskAssessment {
  overallRiskLevel: string;
  riskScore: number;
  credibilityScore: number;
  riskFactors: Array<{
    category: string;
    factor: string;
    severity: string;
    score: number;
    description: string;
    mitigation: string;
  }>;
  threatIndicators: Array<{
    type: string;
    confidence: number;
    source: string;
    details: string;
    recommendedAction: string;
  }>;
}
