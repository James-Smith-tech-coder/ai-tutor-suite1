import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { useAuth } from '../components/AuthProvider';
import { Headphones, Mic, Play, Loader2, FileText, Volume2, Square } from 'lucide-react';
import { cn } from '../lib/utils';

export const AudioTools: React.FC = () => {
  const { user } = useAuth();
  const [ttsText, setTtsText] = useState('Hello! I am your AI tutor. How can I help you today?');
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleGenerateTTS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttsText.trim() || isGeneratingTTS || !user) return;

    setIsGeneratingTTS(true);
    setAudioUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // The API returns PCM 16-bit 24kHz. We need to wrap it in a WAV container for the browser <audio> tag.
        // Or we can use AudioContext to play it directly.
        // Let's use AudioContext to decode and play, or create a WAV blob.
        // Creating a WAV blob is better for the <audio> element.
        
        const buffer = new ArrayBuffer(44 + bytes.length);
        const view = new DataView(buffer);
        
        // RIFF chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + bytes.length, true);
        writeString(view, 8, 'WAVE');
        
        // fmt sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
        view.setUint16(22, 1, true); // NumChannels (1)
        view.setUint32(24, 24000, true); // SampleRate (24000)
        view.setUint32(28, 24000 * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
        view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
        view.setUint16(34, 16, true); // BitsPerSample (16)
        
        // data sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, bytes.length, true);
        
        // Write PCM data
        const pcmData = new Uint8Array(buffer, 44);
        pcmData.set(bytes);
        
        const blob = new Blob([buffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    } catch (error) {
      console.error("TTS error:", error);
      alert("Failed to generate speech.");
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscription(null);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64String,
                  mimeType: audioBlob.type || 'audio/webm',
                },
              },
              {
                text: "Transcribe this audio exactly as spoken.",
              },
            ],
          },
        });

        setTranscription(response.text || "No transcription generated.");
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("Transcription error:", error);
      setTranscription("Failed to transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <header className="px-8 py-6 bg-white border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Headphones className="w-6 h-6 text-indigo-600" />
          Audio Tools
        </h2>
        <p className="text-gray-500 mt-1">Generate speech from text or transcribe your voice.</p>
      </header>

      <div className="flex-1 p-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Text to Speech */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Text to Speech</h3>
          </div>
          
          <form onSubmit={handleGenerateTTS} className="flex-1 flex flex-col">
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="Enter text to convert to speech..."
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none flex-1 mb-6 min-h-[150px]"
            />
            
            <div className="mt-auto space-y-4">
              {audioUrl && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <audio controls src={audioUrl} className="w-full" autoPlay />
                </div>
              )}
              
              <button
                type="submit"
                disabled={!ttsText.trim() || isGeneratingTTS}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isGeneratingTTS ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Speech...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Generate Speech
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Transcription */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Audio Transcription</h3>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={cn(
                "w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all shadow-lg mb-8",
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-red-200 animate-pulse" 
                  : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200",
                isTranscribing && "opacity-50 cursor-not-allowed"
              )}
            >
              {isRecording ? (
                <>
                  <Square className="w-10 h-10 fill-current" />
                  <span className="font-bold">Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-12 h-12" />
                  <span className="font-bold">Record</span>
                </>
              )}
            </button>
            
            <div className="w-full">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Transcript
              </h4>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-[120px]">
                {isTranscribing ? (
                  <div className="flex items-center justify-center h-full text-gray-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                    Transcribing audio...
                  </div>
                ) : transcription ? (
                  <p className="text-gray-800">{transcription}</p>
                ) : (
                  <p className="text-gray-400 text-center italic mt-8">
                    Record some audio to see the transcription here.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
