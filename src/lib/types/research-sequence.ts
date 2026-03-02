/**
 * Research Sequence Types
 * Defines the structure for configurable research workflows
 */

export type ResearchStepType =
  | 'image_analysis'
  | 'face_search'
  | 'username_search'
  | 'email_search'
  | 'phone_search'
  | 'name_search'
  | 'forensics'
  | 'risk_assessment'
  | 'breach_check'
  | 'dark_web_search'
  | 'entity_resolution'
  | 'report_generation';

export type ResearchStepCondition = {
  type: 'always' | 'on_success' | 'on_failure' | 'on_data_found';
  field?: string;
  operator?: 'exists' | 'equals' | 'contains' | 'greater_than' | 'less_than';
  value?: any;
};

export type ResearchStepConfig = {
  id: string;
  name: string;
  type: ResearchStepType;
  description?: string;
  enabled: boolean;
  parameters: Record<string, any>;
  condition?: ResearchStepCondition;
  timeout?: number; // milliseconds
  retryCount?: number;
  outputMapping?: Record<string, string>; // Map output fields to global context
};

export type ResearchSequence = {
  id: string;
  name: string;
  description?: string;
  steps: ResearchStepConfig[];
  createdAt: string;
  updatedAt: string;
  version: number;
  isDefault?: boolean;
};

export type ResearchStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type ResearchStepResult = {
  stepId: string;
  stepName: string;
  status: ResearchStepStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  data?: any;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    cost?: number;
    model?: string;
    confidence?: number;
  };
};

export type ResearchSequenceExecution = {
  id: string;
  sequenceId: string;
  sequenceName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  subject: {
    name?: string;
    email?: string;
    phone?: string;
    username?: string;
    imageBase64?: string;
    hints?: any;
  };
  results: ResearchStepResult[];
  context: Record<string, any>; // Shared data between steps
  startTime?: string;
  endTime?: string;
  totalDuration?: number;
  error?: string;
};

export type ResearchStepTemplate = {
  type: ResearchStepType;
  name: string;
  description: string;
  icon: string;
  category: 'input' | 'analysis' | 'search' | 'output';
  defaultParameters: Record<string, any>;
  requiredParameters: string[];
  outputSchema: Record<string, string>;
};

// Available research step templates
export const RESEARCH_STEP_TEMPLATES: ResearchStepTemplate[] = [
  {
    type: 'image_analysis',
    name: 'AI Image Analysis',
    description: 'Extract data from images using VLM (names, dates, locations, documents, text)',
    icon: 'Image',
    category: 'input',
    defaultParameters: {
      extractText: true,
      detectDocuments: true,
      findEntities: true,
    },
    requiredParameters: [],
    outputSchema: {
      detectedData: 'Extracted structured data',
      textContent: 'Full OCR text',
      confidence: 'Confidence score 0-100',
    },
  },
  {
    type: 'face_search',
    name: 'Facial Recognition Search',
    description: 'Search for matching faces across platforms',
    icon: 'ScanFace',
    category: 'search',
    defaultParameters: {
      threshold: 0.7,
      maxResults: 20,
    },
    requiredParameters: ['imageBase64'],
    outputSchema: {
      matches: 'Array of face matches',
      platforms: 'Platforms where matches found',
    },
  },
  {
    type: 'username_search',
    name: 'Username Search',
    description: 'Search for username across social platforms',
    icon: 'AtSign',
    category: 'search',
    defaultParameters: {
      platforms: 'all',
      deepSearch: false,
    },
    requiredParameters: ['username'],
    outputSchema: {
      profiles: 'Found profiles',
      platforms: 'Platform list',
    },
  },
  {
    type: 'email_search',
    name: 'Email Search',
    description: 'Search by email address',
    icon: 'Mail',
    category: 'search',
    defaultParameters: {
      checkBreaches: true,
      findProfiles: true,
    },
    requiredParameters: ['email'],
    outputSchema: {
      profiles: 'Found profiles',
      breaches: 'Data breach records',
    },
  },
  {
    type: 'phone_search',
    name: 'Phone Number Search',
    description: 'Search by phone number',
    icon: 'Phone',
    category: 'search',
    defaultParameters: {
      format: 'international',
      findOwner: true,
    },
    requiredParameters: ['phone'],
    outputSchema: {
      owner: 'Owner information',
      profiles: 'Associated profiles',
    },
  },
  {
    type: 'name_search',
    name: 'Name Search',
    description: 'Search by person name with context',
    icon: 'User',
    category: 'search',
    defaultParameters: {
      includeAliases: true,
      deepWeb: false,
    },
    requiredParameters: ['name'],
    outputSchema: {
      profiles: 'Found profiles',
      locations: 'Associated locations',
    },
  },
  {
    type: 'forensics',
    name: 'Digital Forensics',
    description: 'Deep fake detection and image authenticity analysis',
    icon: 'Microscope',
    category: 'analysis',
    defaultParameters: {
      deepfakeDetection: true,
      manipulationCheck: true,
      reverseSearch: true,
    },
    requiredParameters: [],
    outputSchema: {
      authenticityScore: '0-100 score',
      deepfakeRisk: 'low|medium|high',
      manipulations: 'Detected edits',
    },
  },
  {
    type: 'risk_assessment',
    name: 'Risk Assessment',
    description: 'Calculate risk score from collected data',
    icon: 'TriangleAlert',
    category: 'analysis',
    defaultParameters: {
      includeDarkWeb: true,
      includeBreaches: true,
    },
    requiredParameters: [],
    outputSchema: {
      riskLevel: 'low|medium|high|critical',
      overallScore: '0-100 score',
      riskFactors: 'Array of risk factors',
    },
  },
  {
    type: 'breach_check',
    name: 'Data Breach Check',
    description: 'Check for data breaches and leaks',
    icon: 'Database',
    category: 'search',
    defaultParameters: {
      includeDarkWeb: true,
    },
    requiredParameters: [],
    outputSchema: {
      breaches: 'Breach records',
      exposedData: 'Types of exposed data',
    },
  },
  {
    type: 'dark_web_search',
    name: 'Dark Web Search',
    description: 'Search dark web markets and forums',
    icon: 'Globe',
    category: 'search',
    defaultParameters: {
      markets: true,
      forums: true,
      pasteSites: true,
    },
    requiredParameters: [],
    outputSchema: {
      listings: 'Found listings',
      mentions: 'Forum mentions',
    },
  },
  {
    type: 'entity_resolution',
    name: 'Entity Resolution',
    description: 'Resolve and merge duplicate identities',
    icon: 'Fingerprint',
    category: 'analysis',
    defaultParameters: {
      confidenceThreshold: 0.8,
    },
    requiredParameters: [],
    outputSchema: {
      resolvedEntities: 'Merged identity records',
      confidence: 'Resolution confidence',
    },
  },
  {
    type: 'report_generation',
    name: 'Generate Report',
    description: 'Create investigation report (PDF/Markdown)',
    icon: 'FileText',
    category: 'output',
    defaultParameters: {
      format: 'pdf',
      includeExecutiveSummary: true,
      includeTimeline: true,
    },
    requiredParameters: [],
    outputSchema: {
      reportUrl: 'Download URL',
      format: 'pdf|markdown',
    },
  },
];

// Pre-built sequence templates
export const SEQUENCE_TEMPLATES: ResearchSequence[] = [
  {
    id: 'quick_identity',
    name: 'Quick Identity Check',
    description: 'Fast search using single identifier',
    steps: [
      {
        id: 'step1',
        name: 'Username Search',
        type: 'username_search',
        enabled: true,
        parameters: { platforms: 'all' },
        condition: { type: 'always' },
      },
      {
        id: 'step2',
        name: 'Risk Assessment',
        type: 'risk_assessment',
        enabled: true,
        parameters: {},
        condition: { type: 'on_success' },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Investigation',
    description: 'Full multi-source investigation with all analysis',
    steps: [
      {
        id: 'step1',
        name: 'AI Image Analysis',
        type: 'image_analysis',
        enabled: true,
        parameters: { extractText: true, detectDocuments: true },
        condition: { type: 'always' },
      },
      {
        id: 'step2',
        name: 'Face Search',
        type: 'face_search',
        enabled: true,
        parameters: { threshold: 0.7 },
        condition: { type: 'on_data_found', field: 'imageBase64' },
      },
      {
        id: 'step3',
        name: 'Username Search',
        type: 'username_search',
        enabled: true,
        parameters: { platforms: 'all', deepSearch: true },
        condition: { type: 'always' },
      },
      {
        id: 'step4',
        name: 'Email Search',
        type: 'email_search',
        enabled: true,
        parameters: { checkBreaches: true },
        condition: { type: 'always' },
      },
      {
        id: 'step5',
        name: 'Digital Forensics',
        type: 'forensics',
        enabled: true,
        parameters: { deepfakeDetection: true },
        condition: { type: 'on_data_found', field: 'imageBase64' },
      },
      {
        id: 'step6',
        name: 'Risk Assessment',
        type: 'risk_assessment',
        enabled: true,
        parameters: { includeDarkWeb: true },
        condition: { type: 'on_success' },
      },
      {
        id: 'step7',
        name: 'Generate Report',
        type: 'report_generation',
        enabled: true,
        parameters: { format: 'pdf' },
        condition: { type: 'on_success' },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  },
  {
    id: 'image_focused',
    name: 'Image-Focused Investigation',
    description: 'Prioritize image analysis and facial recognition',
    steps: [
      {
        id: 'step1',
        name: 'AI Image Analysis',
        type: 'image_analysis',
        enabled: true,
        parameters: { extractText: true, detectDocuments: true, findEntities: true },
        condition: { type: 'always' },
      },
      {
        id: 'step2',
        name: 'Digital Forensics',
        type: 'forensics',
        enabled: true,
        parameters: { deepfakeDetection: true, manipulationCheck: true },
        condition: { type: 'on_success' },
      },
      {
        id: 'step3',
        name: 'Face Search',
        type: 'face_search',
        enabled: true,
        parameters: { threshold: 0.75, maxResults: 50 },
        condition: { type: 'on_data_found', field: 'imageBase64' },
      },
      {
        id: 'step4',
        name: 'Entity Resolution',
        type: 'entity_resolution',
        enabled: true,
        parameters: { confidenceThreshold: 0.85 },
        condition: { type: 'on_success' },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  },
  {
    id: 'breach_investigation',
    name: 'Breach Investigation',
    description: 'Focus on data breaches and exposed credentials',
    steps: [
      {
        id: 'step1',
        name: 'Email Search',
        type: 'email_search',
        enabled: true,
        parameters: { checkBreaches: true, findProfiles: true },
        condition: { type: 'always' },
      },
      {
        id: 'step2',
        name: 'Data Breach Check',
        type: 'breach_check',
        enabled: true,
        parameters: { includeDarkWeb: true },
        condition: { type: 'on_success' },
      },
      {
        id: 'step3',
        name: 'Dark Web Search',
        type: 'dark_web_search',
        enabled: true,
        parameters: { markets: true, forums: true },
        condition: { type: 'on_data_found', field: 'breaches' },
      },
      {
        id: 'step4',
        name: 'Risk Assessment',
        type: 'risk_assessment',
        enabled: true,
        parameters: { includeDarkWeb: true, includeBreaches: true },
        condition: { type: 'on_success' },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  },
];
