import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '../components/AuthProvider';
import { Eye, Upload, Loader2, Image as ImageIcon, Video, FileText } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';

export const Vision: React.FC = () => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('Analyze this media and describe what you see in detail.');
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; type: 'image' | 'video' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith('image/') ? 'image' : 'video';
    
    // For video, we might need to handle size limits, but for this demo we'll read as data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setSelectedFile({
        data: base64String,
        mimeType: file.type,
        type,
      });
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !prompt.trim() || isLoading || !user) return;

    setIsLoading(true);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: selectedFile.data,
                mimeType: selectedFile.mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      setResult(response.text || "No analysis generated.");
    } catch (error) {
      console.error("Vision analysis error:", error);
      setResult("Failed to analyze the media. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <header className="px-8 py-6 bg-white border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Eye className="w-6 h-6 text-indigo-600" />
          Vision Analysis
        </h2>
        <p className="text-gray-500 mt-1">Upload images or videos for Gemini to analyze and understand.</p>
      </header>

      <div className="flex-1 p-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <form onSubmit={handleAnalyze} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Media</label>
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                    selectedFile ? "border-indigo-300 bg-indigo-50" : "border-gray-300 hover:bg-gray-50"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? (
                    <div className="relative">
                      {selectedFile.type === 'image' ? (
                        <img 
                          src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} 
                          alt="Selected" 
                          className="max-h-48 mx-auto rounded-lg shadow-sm"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-900 rounded-lg flex items-center justify-center">
                          <Video className="w-12 h-12 text-white opacity-50" />
                        </div>
                      )}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setResult(null);
                        }}
                        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <div className="flex justify-center gap-4 mb-4">
                        <ImageIcon className="w-10 h-10 text-indigo-400" />
                        <Video className="w-10 h-10 text-emerald-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Click to upload image or video</p>
                      <p className="text-xs text-gray-500">Supports JPG, PNG, MP4, MOV</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What would you like to know about this media?"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-24"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedFile || !prompt.trim() || isLoading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    Analyze Media
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col">
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-700">Analysis Results</h3>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                  <p className="text-gray-500 font-medium">Gemini is looking closely...</p>
                </div>
              ) : result ? (
                <div className="markdown-body prose prose-indigo max-w-none">
                  <Markdown>{result}</Markdown>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                  <Eye className="w-16 h-16 mb-4 opacity-20" />
                  <p>Upload media and click analyze to see results here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
