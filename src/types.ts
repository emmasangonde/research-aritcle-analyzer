export interface ResearchArticleMetadata {
  title: string;
  authors: string[];
  year: string;
  abstract: string;
  method: string;
  results: string;
  discussion: string;
  keywords: string[];
}

export interface StructuredSummary {
  metadata: ResearchArticleMetadata;
  objective: string;
  keyFindings: string;
  implications: string;
  limitations: string;
  qualityMetrics: {
    clarity: number;
    rigor: number;
    evidenceStrength: number;
    interpretation: string;
  };
}

export interface EvaluationItem {
  question: string;
  findings: string;
  relevance: 'High' | 'Medium' | 'Low';
  evaluation: string;
}

export interface AnalysisResult {
  summary: StructuredSummary;
  evaluations: EvaluationItem[];
  overallRelevance: string;
  keywordsRanked: { keyword: string; importance: number }[];
  wordCloudImageUrl?: string;
}
