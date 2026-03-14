import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Chat } from './pages/Chat';
import { ImageStudio } from './pages/ImageStudio';
import { VideoStudio } from './pages/VideoStudio';
import { VoiceChat } from './pages/VoiceChat';
import { Vision } from './pages/Vision';
import { AudioTools } from './pages/AudioTools';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Chat />} />
              <Route path="image" element={<ImageStudio />} />
              <Route path="video" element={<VideoStudio />} />
              <Route path="voice" element={<VoiceChat />} />
              <Route path="vision" element={<Vision />} />
              <Route path="audio" element={<AudioTools />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
