import { AnalysisResult } from "../types";

declare const google: any;

const CLIENT_ID = (import.meta as any).env.VITE_CLIENT_ID;
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file'
].join(' ');

let accessToken: string | null = null;

export const getAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (accessToken) return resolve(accessToken);
    
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            accessToken = response.access_token;
            resolve(response.access_token);
          } else {
            reject(new Error('Failed to get access token'));
          }
        },
      });
      client.requestAccessToken();
    } catch (error) {
      reject(error);
    }
  });
};

export async function exportToGoogleDocs(result: AnalysisResult): Promise<string> {
  const token = await getAccessToken();
  
  // 1. Create a new document
  const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Analysis: ${result.summary.metadata.title}`,
    }),
  });
  
  const doc = await createResponse.json();
  const documentId = doc.documentId;
  
  // 2. Add content to the document
  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text: `Research Article Analysis Report\n\n`,
      },
    },
    {
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: 33 },
        paragraphStyle: { namedStyleType: 'TITLE' },
        fields: 'namedStyleType',
      },
    },
    {
      insertText: {
        location: { index: 33 },
        text: `Structured Summary\n`,
      },
    },
    {
      updateParagraphStyle: {
        range: { startIndex: 33, endIndex: 52 },
        paragraphStyle: { namedStyleType: 'HEADING_1' },
        fields: 'namedStyleType',
      },
    },
    {
      insertText: {
        location: { index: 52 },
        text: `Title: ${result.summary.metadata.title}\nAuthors: ${result.summary.metadata.authors.join(', ')}\nYear: ${result.summary.metadata.year}\nObjective: ${result.summary.objective}\nKey Findings: ${result.summary.keyFindings}\nImplications: ${result.summary.implications}\nLimitations: ${result.summary.limitations}\n\nQuality Check Metrics:\n`,
      },
    },
    {
      insertText: {
        location: { index: 52 + 500 }, // Approximate offset
        text: `Clarity of research question: ${result.summary.qualityMetrics.clarity}/5\nRigor of methodology: ${result.summary.qualityMetrics.rigor}/5\nEvidence strength: ${result.summary.qualityMetrics.evidenceStrength}/5\nInterpretation: ${result.summary.qualityMetrics.interpretation}\n\n`,
      },
    },
    // Adding Evaluation Table as text since Docs API tables are complex to build via simple requests
    {
        insertText: {
            location: { index: 52 + 1000 },
            text: `Evaluation of Findings Against Research Questions\n`,
        }
    }
  ];

  // We could add more complex table requests here, but for simplicity we'll do basic text insertion for now
  // or a series of simple formatting requests.
  
  await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  
  return `https://docs.google.com/document/d/${documentId}/edit`;
}
