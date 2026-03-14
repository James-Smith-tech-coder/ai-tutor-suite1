import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { useAuth } from '../components/AuthProvider';
import { Send, Bot, User, Loader2, Sparkles, MapPin, Search, Zap, Brain } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } from 'firebase/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type ChatMode = 'pro' | 'fast' | 'think' | 'maps' | 'search';

const MODES: Record<ChatMode, { name: string; icon: React.ElementType; desc: string; model: string; config?: any }> = {
  pro: { name: 'Tutor (Pro)', icon: Sparkles, desc: 'Smart, balanced responses', model: 'gemini-3.1-pro-preview' },
  fast: { name: 'Fast', icon: Zap, desc: 'Quick answers', model: 'gemini-3.1-flash-lite-preview' },
  think: { name: 'Deep Thinker', icon: Brain, desc: 'Complex reasoning', model: 'gemini-3.1-pro-preview', config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } } },
  maps: { name: 'Local Guide', icon: MapPin, desc: 'Location & maps data', model: 'gemini-2.5-flash', config: { tools: [{ googleMaps: {} }] } },
  search: { name: 'Researcher', icon: Search, desc: 'Web search grounding', model: 'gemini-3-flash-preview', config: { tools: [{ googleSearch: {} }] } },
};

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('pro');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    // Create a new chat session if none exists
    const initChat = async () => {
      try {
        const newChatRef = doc(collection(db, 'chats'));
        await setDoc(newChatRef, {
          uid: user.uid,
          title: 'New Conversation',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setChatId(newChatRef.id);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'chats');
      }
    };
    
    initChat();
  }, [user]);

  useEffect(() => {
    if (!chatId) return;
    
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      scrollToBottom();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });
    
    return () => unsubscribe();
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatId || !user) return;

    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // Save user message
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        role: 'user',
        text: userText,
        createdAt: serverTimestamp(),
      });

      const selectedMode = MODES[mode];
      
      // Prepare history for Gemini
      const contents = messages.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: userText }] });

      // System instruction for the tutor persona
      const systemInstruction = "You are an AI assistant that combines the abilities and style of ChatGPT and Google Gemini. Respond in clear, simple English. Give accurate, helpful answers and explain things step by step when needed. Be friendly, patient, and easy to understand. If the user asks about technology, learning, or problem solving, guide them like a helpful tutor. Keep answers organized and useful.";

      const response = await ai.models.generateContent({
        model: selectedMode.model,
        contents,
        config: {
          systemInstruction,
          ...selectedMode.config,
        },
      });
      
      let responseText = response.text || "I couldn't generate a response.";

      // Handle Map Grounding URLs
      if (mode === 'maps' && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const chunks = response.candidates[0].groundingMetadata.groundingChunks;
        const urls = chunks.map((c: any) => c.web?.uri || c.maps?.uri).filter(Boolean);
        if (urls.length > 0) {
          responseText += '\n\n**Sources:**\n' + urls.map((url: string) => `- [${url}](${url})`).join('\n');
        }
      }

      // Save model message
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        role: 'model',
        text: responseText,
        createdAt: serverTimestamp(),
      });

    } catch (error) {
      console.error("Chat error:", error);
      // Save error message
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        role: 'model',
        text: "I'm sorry, I encountered an error while processing your request. Please try again.",
        createdAt: serverTimestamp(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white z-10">
        <div>
          <h2 className="text-xl font-bold text-gray-800">AI Tutor Chat</h2>
          <p className="text-sm text-gray-500">Ask me anything, I'm here to help!</p>
        </div>
        
        {/* Mode Selector */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {(Object.keys(MODES) as ChatMode[]).map((m) => {
            const ModeIcon = MODES[m].icon;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  mode === m ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
                )}
                title={MODES[m].desc}
              >
                <ModeIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{MODES[m].name}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">How can I help you today?</h3>
            <p className="text-gray-500">
              I'm your friendly AI tutor. Select a mode above and ask me a question to get started!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-4 max-w-4xl mx-auto",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                msg.role === 'user' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-white"
              )}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={cn(
                "px-5 py-3.5 rounded-2xl max-w-[80%]",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm"
              )}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div className="markdown-body prose prose-sm max-w-none prose-indigo">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-4 max-w-4xl mx-auto">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 mt-1">
              <Bot className="w-5 h-5" />
            </div>
            <div className="px-5 py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span className="text-sm text-gray-500">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Type your message here..."
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[52px] max-h-32"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="text-center mt-2">
          <p className="text-xs text-gray-400">Press Enter to send, Shift+Enter for new line.</p>
        </div>
      </div>
    </div>
  );
};
