import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeArticle(text: string, researchQuestions: string[]): Promise<AnalysisResult> {
  const prompt = `
    Analyze the following research article text and evaluate it against these research questions:
    ${researchQuestions.join('\n')}

    Article Text (Truncated if necessary):
    ${text.substring(0, 30000)}

    Provide a structured JSON response according to the following schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.OBJECT,
            properties: {
              metadata: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                  year: { type: Type.STRING },
                  abstract: { type: Type.STRING },
                  method: { type: Type.STRING },
                  results: { type: Type.STRING },
                  discussion: { type: Type.STRING },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                }
              },
              objective: { type: Type.STRING },
              keyFindings: { type: Type.STRING },
              implications: { type: Type.STRING },
              limitations: { type: Type.STRING },
              qualityMetrics: {
                type: Type.OBJECT,
                properties: {
                  clarity: { type: Type.NUMBER },
                  rigor: { type: Type.NUMBER },
                  evidenceStrength: { type: Type.NUMBER },
                  interpretation: { type: Type.STRING },
                }
              }
            }
          },
          evaluations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                findings: { type: Type.STRING },
                relevance: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                evaluation: { type: Type.STRING },
              }
            }
          },
          overallRelevance: { type: Type.STRING },
          keywordsRanked: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                keyword: { type: Type.STRING },
                importance: { type: Type.NUMBER },
              }
            }
          }
        }
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate analysis result");
  }

  return JSON.parse(response.text);
}
