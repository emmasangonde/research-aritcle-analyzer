/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileText, 
  Search, 
  Download, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileDown,
  BarChart3,
  Hash
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { extractTextFromPdf } from './services/pdfService';
import { analyzeArticle } from './services/geminiService';
import { exportToGoogleDocs } from './services/googleDocsService';
import { AnalysisResult } from './types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wordCloudUrl, setWordCloudUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile && uploadedFile.type === 'application/pdf') {
      setFile(uploadedFile);
      setError(null);
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const generateWordCloud = async (keywords: string[]) => {
    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Generate a clean, professional-style word cloud using the following keywords, with larger font for higher frequency or importance: ${keywords.join(', ')}. Use a white background and neutral blue-grey colour palette.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setWordCloudUrl(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error('Image generation failed:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setWordCloudUrl(null);

    try {
      const text = await extractTextFromPdf(file);
      const questionList = questions.split('\n').filter(q => q.trim() !== '');
      const analysisResult = await analyzeArticle(text, questionList);
      setResult(analysisResult);
      
      // Generate word cloud in background
      generateWordCloud(analysisResult.keywordsRanked.map(k => k.keyword));
    } catch (err) {
      setError('Analysis failed. Please try again or with a smaller PDF.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportAsPDF = () => {
    if (!result) return;
    const doc = new jsPDF() as any;
    
    doc.setFontSize(20);
    doc.text('Research Article Analysis Report', 14, 22);
    
    doc.setFontSize(14);
    doc.text('Structured Summary', 14, 35);
    
    doc.setFontSize(10);
    doc.text(`Title: ${result.summary.metadata.title}`, 14, 45);
    doc.text(`Authors: ${result.summary.metadata.authors.join(', ')}`, 14, 52);
    doc.text(`Year: ${result.summary.metadata.year}`, 14, 59);
    
    doc.text('Objective:', 14, 69);
    const splitObjective = doc.splitTextToSize(result.summary.objective, 180);
    doc.text(splitObjective, 14, 75);
    
    const yAfterObjective = 75 + (splitObjective.length * 5) + 5;
    
    autoTable(doc, {
        startY: yAfterObjective,
        head: [['Research Question', 'Related Findings', 'Relevance', 'Evaluation']],
        body: result.evaluations.map(e => [e.question, e.findings, e.relevance, e.evaluation]),
    });
    
    doc.save(`Analysis_${result.summary.metadata.title.substring(0, 20)}.pdf`);
  };

  const handleGoogleDocsExport = async () => {
    if (!result) return;
    try {
      const url = await exportToGoogleDocs(result);
      window.open(url, '_blank');
    } catch (err) {
      setError('Google Docs export failed. Ensure popups are allowed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-sky-500/30">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <FileText className="text-sky-400 w-6 h-6" />
              <h1 className="text-2xl font-serif italic text-sky-400 leading-tight">Research Article Analyzer</h1>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-1 ml-9">Academic Intelligence & Synthesis Platform</p>
          </div>
          {result && (
            <div className="flex gap-3">
              <button 
                onClick={handleGoogleDocsExport}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 border border-sky-500 rounded text-xs text-white hover:bg-sky-500 transition-all font-semibold shadow-lg shadow-sky-900/20 active:scale-95"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Export to Google Docs
              </button>
              <button 
                onClick={exportAsPDF}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded text-xs hover:bg-slate-700 transition-all text-slate-300 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                Export as PDF
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Inputs Section */}
          <aside className="lg:col-span-3 space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl shadow-xl">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Document Upload</h2>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group bg-slate-900 ${file ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-700 hover:border-slate-600'}`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".pdf" 
                  className="hidden" 
                />
                <div className={`p-3 rounded-full transition-transform group-hover:scale-110 ${file ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  {file ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                </div>
                <div className="text-center overflow-hidden w-full">
                  <p className="text-xs font-medium truncate px-2">{file ? file.name : 'Click to Upload PDF'}</p>
                  {file && <p className="text-[10px] text-sky-500 mt-1">File uploaded successfully</p>}
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl shadow-xl flex-1">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Research Questions</h2>
              <textarea 
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                placeholder="Add research questions (one per line)..."
                className="w-full h-40 p-3 bg-slate-950 border border-slate-800 rounded-xl focus:border-sky-500 text-xs leading-relaxed outline-none transition-all resize-none text-slate-300 placeholder:text-slate-700"
              />
              <div className="mt-3 p-2 bg-slate-800 rounded border-l-2 border-sky-500">
                <p className="text-[10px] leading-relaxed text-slate-400 italic">Example: How does collaboration drive innovation?</p>
              </div>
            </div>

            <button 
              onClick={handleAnalyze}
              disabled={!file || isAnalyzing}
              className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${!file || isAnalyzing ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50' : 'bg-sky-600 text-white hover:bg-sky-500 active:scale-[0.98] shadow-lg shadow-sky-900/20'}`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                  Analyzing with Gemini...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Analyze Article
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-3 text-red-400 text-xs"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {result && (
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
                 <h2 className="text-[10px] font-bold uppercase font-sans tracking-widest text-slate-400 mb-4">Dominant Themes</h2>
                 <div className="flex flex-wrap gap-1.5">
                   {result.keywordsRanked.slice(0, 8).map((kw, i) => (
                     <span 
                       key={i} 
                       className={`px-2 py-1 text-[10px] rounded border transition-colors ${i < 3 ? 'bg-sky-950/30 text-sky-400 border-sky-900/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                     >
                       {kw.keyword}
                     </span>
                   ))}
                 </div>
              </div>
            )}
          </aside>

          {/* Results Section */}
          <section className="lg:col-span-9 min-h-[600px]">
            <AnimatePresence mode="wait">
              {!result && !isAnalyzing ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-800 rounded-3xl opacity-30 bg-slate-900/20"
                >
                  <BarChart3 className="w-20 h-20 mb-6 text-slate-600" />
                  <h3 className="text-2xl font-serif text-slate-300">Awaiting Input</h3>
                  <p className="max-w-xs mt-3 text-xs leading-relaxed text-slate-500">Document analysis and synthesis will appear here once the process begins.</p>
                </motion.div>
              ) : result ? (
                <motion.div 
                  key="results"
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Summary Section */}
                    <div className="flex flex-col gap-6">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-sky-500/10 transition-colors" />
                        
                        <div className="mb-6">
                           <h3 className="text-2xl font-serif text-white leading-tight mb-2">{result.summary.metadata.title}</h3>
                           <p className="text-[11px] text-slate-400 flex items-center gap-2">
                             <span className="font-semibold text-sky-400/80">{result.summary.metadata.authors.join(', ')}</span>
                             <span className="w-1 h-1 bg-slate-700 rounded-full" />
                             <span>({result.summary.metadata.year})</span>
                           </p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 text-[12px] leading-relaxed text-slate-300">
                          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                            <span className="text-sky-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Objective</span>
                            {result.summary.objective}
                          </div>
                          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                            <span className="text-sky-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Methodology</span>
                            {result.summary.metadata.method || result.summary.objective}
                          </div>
                          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                            <span className="text-sky-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Key Findings</span>
                            {result.summary.keyFindings}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                              <span className="text-sky-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Implications</span>
                              <span className="line-clamp-4">{result.summary.implications}</span>
                            </div>
                            <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                              <span className="text-sky-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Limitations</span>
                              <span className="line-clamp-4">{result.summary.limitations}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col items-center">
                          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-5">Quality Check Metrics</h4>
                          <div className="grid grid-cols-3 gap-12 w-full max-w-sm">
                            <div className="text-center group-hover:transform transition-transform">
                              <p className="text-2xl font-serif text-white">{result.summary.qualityMetrics.clarity}<span className="text-xs text-slate-500 ml-0.5">/5</span></p>
                              <p className="text-[9px] text-slate-500 uppercase tracking-tighter mt-1">Clarity</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-serif text-white">{result.summary.qualityMetrics.rigor}<span className="text-xs text-slate-500 ml-0.5">/5</span></p>
                              <p className="text-[9px] text-slate-500 uppercase tracking-tighter mt-1">Methodology</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-serif text-white">{result.summary.qualityMetrics.evidenceStrength}<span className="text-xs text-slate-500 ml-0.5">/5</span></p>
                              <p className="text-[9px] text-slate-500 uppercase tracking-tighter mt-1">Evidence</p>
                            </div>
                          </div>
                          <div className="mt-6 w-full py-3 px-4 bg-sky-950/20 border border-sky-900/30 rounded-xl text-center">
                            <p className="text-[11px] text-sky-400/90 italic italic-small tracking-tight">
                              “{result.summary.qualityMetrics.interpretation}”
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Overall Summary */}
                      <div className="bg-sky-950/20 border border-sky-900/30 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400 mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Overall Relevance Summary
                        </h2>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          {result.overallRelevance}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-8">
                      {/* Evaluation Table */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden h-fit">
                        <div className="p-4 border-b border-slate-800 bg-slate-800/30">
                          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-sky-400" />
                            Evaluation Against Questions
                          </h2>
                        </div>
                        <div className="overflow-hidden">
                          <table className="w-full text-[10px] text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-900 border-b border-slate-800">
                                <th className="p-3 font-semibold text-slate-500 uppercase tracking-tighter w-1/3">Question</th>
                                <th className="p-3 font-semibold text-slate-500 uppercase tracking-tighter">Relevance</th>
                                <th className="p-3 font-semibold text-slate-500 uppercase tracking-tighter">Evaluation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.evaluations.map((evalItem, idx) => (
                                <tr key={idx} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors">
                                  <td className="p-3 align-top italic text-slate-300">{evalItem.question}</td>
                                  <td className="p-3 align-top">
                                    <span className={`font-bold px-2 py-0.5 rounded text-[9px] ${
                                      evalItem.relevance === 'High' ? 'text-green-400 bg-green-400/10' :
                                      evalItem.relevance === 'Medium' ? 'text-yellow-400 bg-yellow-400/10' :
                                      'text-slate-400 bg-slate-400/10'
                                    }`}>
                                      {evalItem.relevance}
                                    </span>
                                  </td>
                                  <td className="p-3 text-slate-400 leading-relaxed font-light">{evalItem.evaluation}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Word Cloud Visualization */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                           <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Keyword Theme Visualisation</h2>
                           {wordCloudUrl && (
                             <a 
                               href={wordCloudUrl} 
                               download="wordcloud.png"
                               className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                             >
                               <Download className="w-3 h-3" />
                               Download
                             </a>
                           )}
                        </div>
                        
                        <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-6 relative overflow-hidden min-h-[300px]">
                          {isGeneratingImage ? (
                            <div className="flex flex-col items-center gap-4 text-slate-600">
                              <Loader2 className="w-8 h-8 animate-spin" />
                              <p className="text-[10px] font-bold uppercase tracking-widest">Generating Visual...</p>
                            </div>
                          ) : wordCloudUrl ? (
                            <div className="relative w-full h-full group">
                              <img 
                                src={wordCloudUrl} 
                                alt="Keyword Cloud" 
                                className="w-full h-full object-contain filter brightness-90 hover:brightness-100 transition-all duration-700"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 pointer-events-none border-[1px] border-slate-800/50 shadow-[inset_0_0_80px_rgba(0,0,0,0.6)] rounded-lg"></div>
                            </div>
                          ) : (
                            <div className="text-center space-y-2 opacity-20">
                              <BarChart3 className="w-12 h-12 mx-auto text-slate-600" />
                              <p className="text-[10px] font-bold uppercase tracking-widest">Synthesising Graphical Overlay</p>
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-600 italic mt-4 text-center">“Augmented Keyword Visualization Engine Powered by Gemini”</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : isAnalyzing && (
                <div className="h-full flex flex-col items-center justify-center gap-8 py-24">
                  <div className="relative">
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1], rotate: [0, 90, 180, 270, 360] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 border-2 border-sky-500/20 rounded-full border-t-sky-500"
                    />
                    <FileText className="absolute inset-0 m-auto w-8 h-8 text-sky-400 animate-pulse" />
                  </div>
                  <div className="text-center space-y-3">
                    <h3 className="text-2xl font-serif text-white tracking-tight">Synthesizing Intelligence</h3>
                    <p className="text-slate-500 max-w-sm mx-auto text-xs leading-relaxed uppercase tracking-widest animate-pulse">
                      Parsing multidimensional datasets and mapping findings to investigative queries
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
}
