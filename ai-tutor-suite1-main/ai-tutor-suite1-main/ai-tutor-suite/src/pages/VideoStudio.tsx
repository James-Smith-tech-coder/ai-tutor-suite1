import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '../components/AuthProvider';
import { Video, Loader2, Key, Upload, Film, Layout } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type AspectRatioType = '16:9' | '9:16';

export const VideoStudio: React.FC = () => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setHasKey(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setSelectedImage({
        data: base64String,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!prompt.trim() && !selectedImage) || isLoading || !user || !hasKey) return;

    setIsLoading(true);
    setGeneratedVideoUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
      
      const config: any = {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio,
      };

      const requestParams: any = {
        model: 'veo-3.1-fast-generate-preview',
        config,
      };

      if (prompt.trim()) {
        requestParams.prompt = prompt;
      }

      if (selectedImage) {
        requestParams.image = {
          imageBytes: selectedImage.data,
          mimeType: selectedImage.mimeType,
        };
      }

      let operation = await ai.models.generateVideos(requestParams);

      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (downloadLink) {
        // We need to fetch the video with the API key in the header
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': apiKey || '',
          },
        });
        
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setGeneratedVideoUrl(objectUrl);
        
        // Save metadata to Firestore
        await addDoc(collection(db, 'creations'), {
          uid: user.uid,
          type: 'video',
          prompt: prompt || 'Image to Video',
          url: downloadLink, // Storing the original URI
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Video generation error:", error);
      alert("Failed to generate video. Please try again or check your API key.");
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
            To use the Veo video generation models, you need to select a paid Gemini API key.
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
          <Film className="w-6 h-6 text-indigo-600" />
          Video Studio
        </h2>
        <p className="text-gray-500 mt-1">Generate high-quality videos from text or images using Veo.</p>
      </header>

      <div className="flex-1 p-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Layout className="w-4 h-4" /> Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatioType)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Portrait)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Starting Image (Optional)</label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedImage ? (
                    <div className="relative">
                      <img 
                        src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                        alt="Selected" 
                        className="max-h-32 mx-auto rounded-lg"
                      />
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(null);
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click to upload an image</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the video you want to generate..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-32"
                />
              </div>

              <button
                type="submit"
                disabled={(!prompt.trim() && !selectedImage) || isLoading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating (Takes a few mins)...
                  </>
                ) : (
                  <>
                    <Video className="w-5 h-5" />
                    Generate Video
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
              <div className="text-center p-8">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">Directing your video...</h3>
                <p className="text-gray-500">
                  This process usually takes a few minutes. Grab a coffee while Veo works its magic!
                </p>
              </div>
            ) : generatedVideoUrl ? (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <video 
                  src={generatedVideoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="max-w-full max-h-full"
                />
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <Film className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Your generated video will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
