import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Send, 
  Timer as TimerIcon, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  MessageSquare,
  Briefcase,
  Coffee,
  User,
  ChevronRight,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiResponse, Message } from './services/gemini';

type Phase = 'warmup' | 'scenario' | 'improvement' | 'confidence' | 'completed';

interface Scenario {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const SCENARIOS: Scenario[] = [
  { id: 'daily', title: 'Daily Life', icon: <User className="w-5 h-5" />, description: 'Talk about your day and hobbies.' },
  { id: 'interview', title: 'Job Interview', icon: <Briefcase className="w-5 h-5" />, description: 'Practice common HR questions.' },
  { id: 'restaurant', title: 'Restaurant', icon: <Coffee className="w-5 h-5" />, description: 'Order food and handle requests.' },
];

export default function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [phase, setPhase] = useState<Phase>('warmup');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Speech Recognition Setup
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sessionActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          // Update phase based on time
          if (newTime <= 120) setPhase('confidence');
          else if (newTime <= 240) setPhase('improvement');
          else if (newTime <= 480) setPhase('scenario');
          
          if (newTime <= 0) {
            setSessionActive(false);
            setPhase('completed');
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionActive, timeLeft]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startSession = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setSessionActive(true);
    setTimeLeft(600);
    setPhase('warmup');
    setMessages([{ 
      role: 'model', 
      text: `Hi! I'm your SpeakEasy coach. Let's start our 10-minute session. ${scenario.id === 'daily' ? "How are you feeling today?" : `Ready for your ${scenario.title} practice? Let's begin.`}` 
    }]);
  };

  const handleSend = async (text: string = userInput) => {
    if (!text.trim() || isLoading) return;

    const newUserMessage: Message = { role: 'user', text };
    setMessages(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const responseText = await getGeminiResponse(messages, text, phase);
      
      // Parse for corrections
      let cleanText = responseText || "";
      let correction;
      
      if (cleanText.includes('❌')) {
        const lines = cleanText.split('\n');
        const original = lines.find(l => l.startsWith('❌'))?.replace('❌', '').trim();
        const corrected = lines.find(l => l.startsWith('✅'))?.replace('✅', '').trim();
        const tip = lines.find(l => l.startsWith('💡'))?.replace('💡', '').trim();
        const telugu = lines.find(l => l.startsWith('🇮🇳'))?.replace('🇮🇳', '').trim();
        
        if (original && corrected && tip && telugu) {
          correction = { original, corrected, tip, telugu };
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: cleanText, correction }]);
      
      // Text to Speech for AI response
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText.replace(/[❌✅💡🇮🇳]/g, ''));
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I had a small glitch. Can you repeat that?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!sessionActive && phase !== 'completed') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight text-gray-900">SpeakEasy 10</h1>
            <p className="text-gray-500 text-lg">Master English in 10 minutes a day.</p>
          </div>

          <div className="grid gap-4">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => startSession(s)}
                className="flex items-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-gray-300 transition-all group text-left"
              >
                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors mr-4">
                  {s.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-900 transition-colors" />
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
            Powered by Gemini AI
          </p>
        </motion.div>
      </div>
    );
  }

  if (phase === 'completed') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl text-center space-y-6"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-gray-900">Session Complete!</h2>
            <p className="text-gray-500">You practiced for 10 minutes today. Great job!</p>
          </div>
          
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Session Stats</h4>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Messages exchanged</span>
              <span className="font-bold text-gray-900">{messages.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Scenario</span>
              <span className="font-bold text-gray-900">{selectedScenario?.title}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setPhase('warmup');
              setSessionActive(false);
              setMessages([]);
            }}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Start New Session
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col font-sans max-w-2xl mx-auto shadow-2xl">
      {/* Header */}
      <header className="bg-white border-bottom border-gray-100 p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 leading-tight">{selectedScenario?.title}</h2>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{phase}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-bold ${timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-50 text-gray-900'}`}>
          <TimerIcon className="w-4 h-4" />
          {formatTime(timeLeft)}
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-gray-900 text-white rounded-tr-none' 
                    : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {msg.text.split('\n').filter(l => !l.startsWith('❌') && !l.startsWith('✅') && !l.startsWith('💡')).join('\n').trim()}
                  </p>
                </div>

                {msg.correction && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2 text-sm"
                  >
                    <div className="flex items-start gap-2 text-red-600">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="line-through opacity-60">{msg.correction.original}</span>
                    </div>
                    <div className="flex items-start gap-2 text-green-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{msg.correction.corrected}</span>
                    </div>
                    <div className="pt-2 border-t border-amber-200/50 text-amber-800 italic">
                      {msg.correction.tip}
                    </div>
                    <div className="pt-1 text-gray-600 font-medium">
                      🇮🇳 {msg.correction.telugu}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-gray-100 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleListening}
            className={`p-4 rounded-2xl transition-all ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? "Listening..." : "Type or speak your answer..."}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-gray-900 transition-all text-gray-900 placeholder:text-gray-400"
            />
            <button
              onClick={() => handleSend()}
              disabled={!userInput.trim() || isLoading}
              className="absolute right-2 top-2 p-2 bg-gray-900 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex justify-center gap-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Volume2 className="w-3 h-3" /> AI Voice Enabled
          </p>
        </div>
      </footer>
    </div>
  );
}
