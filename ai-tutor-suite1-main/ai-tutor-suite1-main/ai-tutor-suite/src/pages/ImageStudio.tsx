import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '../components/AuthProvider';
import { Image as ImageIcon, Loader2, Key, Download, Layout, Maximize } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type ImageMode = 'flash' | 'pro';
type AspectRatioType = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '1:4' | '1:8' | '4:1' | '8:1';
type ImageSize = '512px' | '1K' | '2K' | '4K';

export const ImageStudio: React.FC = () => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<ImageMode>('flash');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true); // Assume success to mitigate race condition
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading || !user || !hasKey) return;

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      // Create a new instance with the selected key (injected into process.env.API_KEY)
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
      
      const model = mode === 'flash' ? 'gemini-3.1-flash-image-preview' : 'gemini-3-pro-image-preview';
      
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setGeneratedImage(imageUrl);
        
        // Save to Firestore
        await addDoc(collection(db, 'creations'), {
          uid: user.uid,
          type: 'image',
          prompt,
          url: imageUrl,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Image generation error:", error);
      alert("Failed to generate image. Please try again or check your API key.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">API Key Required</h2>
          <p className="text-gray-600 mb-8">
            To use the advanced image generation models (Nano Banana 2 and Pro), you need to select a paid Gemini API key.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <header className="px-8 py-6 bg-white border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-indigo-600" />
          Image Studio
        </h2>
        <p className="text-gray-500 mt-1">Create stunning images from text prompts.</p>
      </header>

      <div className="flex-1 p-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('flash')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      mode === 'flash' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Flash (Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('pro')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      mode === 'pro' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Pro (High Quality)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Layout className="w-4 h-4" /> Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatioType)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="1:1">1:1 (Square)</option>
                  <option value="4:3">4:3 (Landscape)</option>
                  <option value="3:4">3:4 (Portrait)</option>
                  <option value="16:9">16:9 (Widescreen)</option>
                  <option value="9:16">9:16 (Vertical)</option>
                  {mode === 'flash' && (
                    <>
                      <option value="1:4">1:4</option>
                      <option value="1:8">1:8</option>
                      <option value="4:1">4:1</option>
                      <option value="8:1">8:1</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Maximize className="w-4 h-4" /> Image Size
                </label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as ImageSize)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {mode === 'flash' && <option value="512px">512px</option>}
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-32"
                />
              </div>

              <button
                type="submit"
                disabled={!prompt.trim() || isLoading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5" />
                    Generate Image
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex items-center justify-center min-h-[400px] relative">
            {isLoading ? (
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Creating your masterpiece...</p>
              </div>
            ) : generatedImage ? (
              <div className="relative w-full h-full group">
                <img
                  src={generatedImage}
                  alt={prompt}
                  className="w-full h-full object-contain p-4"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={generatedImage}
                    download="generated-image.png"
                    className="bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-sm text-gray-700 hover:text-indigo-600 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    <span className="text-sm font-medium pr-1">Download</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Your generated image will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
