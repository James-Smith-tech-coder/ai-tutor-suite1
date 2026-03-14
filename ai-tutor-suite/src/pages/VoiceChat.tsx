import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { useAuth } from '../components/AuthProvider';
import { Mic, MicOff, Loader2, Activity, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';

export const VoiceChat: React.FC = () => {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const initAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      return { audioCtx, processor };
    } catch (err) {
      console.error("Microphone access denied:", err);
      setError("Please allow microphone access to use Voice Chat.");
      throw err;
    }
  };

  const startLiveSession = async () => {
    if (!user) return;
    setIsConnecting(true);
    setError(null);
    setTranscript([]);

    try {
      const { audioCtx, processor } = await initAudio();
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a helpful, friendly AI tutor. Keep your answers concise and conversational.",
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsRecording(true);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32Array to Int16Array (PCM 16-bit)
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              
              // Convert to base64
              const buffer = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < buffer.byteLength; i++) {
                binary += String.fromCharCode(buffer[i]);
              }
              const base64Data = btoa(binary);
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Decode PCM 16-bit 24kHz to AudioBuffer
              const pcm16 = new Int16Array(bytes.buffer);
              const audioBuffer = audioContextRef.current.createBuffer(1, pcm16.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 0x7FFF;
              }
              
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);
              
              const currentTime = audioContextRef.current.currentTime;
              if (nextPlayTimeRef.current < currentTime) {
                nextPlayTimeRef.current = currentTime;
              }
              source.start(nextPlayTimeRef.current);
              nextPlayTimeRef.current += audioBuffer.duration;
            }
            
            // Handle Interruption
            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = 0;
            }
            
            // Handle Transcription
            const modelTrans = message.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
            if (modelTrans) {
              setTranscript(prev => [...prev, { role: 'model', text: modelTrans }]);
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error occurred.");
            stopLiveSession();
          },
          onclose: () => {
            stopLiveSession();
          }
        }
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (err) {
      setIsConnecting(false);
      setIsRecording(false);
      console.error(err);
    }
  };

  const stopLiveSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setIsConnecting(false);
    nextPlayTimeRef.current = 0;
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="px-8 py-6 bg-white border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mic className="w-6 h-6 text-indigo-600" />
          Live Voice Chat
        </h2>
        <p className="text-gray-500 mt-1">Have a real-time conversation with your AI tutor.</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-200 p-8 text-center relative overflow-hidden">
          
          {/* Animated Background for active state */}
          {isRecording && (
            <div className="absolute inset-0 bg-indigo-50/50 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse"></div>
              <div className="w-48 h-48 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse delay-1000 absolute ml-20"></div>
            </div>
          )}

          <div className="relative z-10">
            <div className="mb-8">
              {isConnecting ? (
                <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Loader2 className="w-10 h-10 animate-spin" />
                </div>
              ) : isRecording ? (
                <div className="w-24 h-24 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-indigo-200 animate-bounce">
                  <Activity className="w-10 h-10" />
                </div>
              ) : (
                <div className="w-24 h-24 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <MicOff className="w-10 h-10" />
                </div>
              )}
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {isConnecting ? "Connecting..." : isRecording ? "Listening..." : "Ready to chat?"}
            </h3>
            <p className="text-gray-500 mb-8 h-12">
              {isConnecting 
                ? "Establishing connection to Gemini Live API..." 
                : isRecording 
                  ? "Speak naturally. The AI will respond in real-time." 
                  : "Click the button below to start a voice conversation."}
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              onClick={isRecording ? stopLiveSession : startLiveSession}
              disabled={isConnecting}
              className={cn(
                "w-full py-4 px-8 rounded-2xl font-bold text-lg transition-all shadow-sm flex items-center justify-center gap-3",
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-red-200" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200",
                isConnecting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-6 h-6" />
                  End Conversation
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6" />
                  Start Conversation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Transcript */}
        {transcript.length > 0 && (
          <div className="w-full max-w-2xl mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-200 max-h-64 overflow-y-auto">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Live Transcript
            </h4>
            <div className="space-y-4">
              {transcript.map((t, i) => (
                <div key={i} className={cn("text-sm", t.role === 'model' ? "text-indigo-700" : "text-gray-600")}>
                  <span className="font-bold mr-2">{t.role === 'model' ? 'AI:' : 'You:'}</span>
                  {t.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
