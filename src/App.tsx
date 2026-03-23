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
  Volume2,
  BookOpen,
  GraduationCap,
  X,
  Info
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
  { id: 'grammar', title: 'Grammar Basics', icon: <BookOpen className="w-5 h-5" />, description: 'Learn Be, Have, and Can forms.' },
  { id: 'grammar_master', title: 'Grammar Master', icon: <GraduationCap className="w-5 h-5" />, description: 'Tenses, Prepositions, and Articles.' },
];

export default function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
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

          <button
            onClick={() => setShowGuide(true)}
            className="w-full flex items-center justify-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-2xl font-bold hover:bg-blue-100 transition-colors"
          >
            <Info className="w-5 h-5" />
            Grammar Cheat Sheet (Telugu)
          </button>

          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
            Powered by Gemini AI
          </p>
        </motion.div>

        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-2xl max-h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Grammar Cheat Sheet</h2>
                      <p className="text-sm text-gray-500">Quick rules with Telugu explanations</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowGuide(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Be Forms */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-sm">01</span>
                      Be Forms (am, is, are)
                    </h3>
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-gray-600">Used to describe a person, place, or thing in the present.</p>
                      <p className="text-sm font-medium text-blue-800">🇮🇳 ప్రస్తుతం ఒక వ్యక్తి లేదా వస్తువు గురించి చెప్పేటప్పుడు వాడతాము.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Example</p>
                          <p className="text-sm font-semibold">I am a student.</p>
                          <p className="text-xs text-gray-500">నేను ఒక విద్యార్థిని.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Example</p>
                          <p className="text-sm font-semibold">She is happy.</p>
                          <p className="text-xs text-gray-500">ఆమె సంతోషంగా ఉంది.</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Have Forms */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-green-100 text-green-700 rounded-lg flex items-center justify-center text-sm">02</span>
                      Have Forms (have, has)
                    </h3>
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-gray-600">Used to show possession (something you own).</p>
                      <p className="text-sm font-medium text-green-800">🇮🇳 మన దగ్గర ఏదైనా ఉంది అని చెప్పేటప్పుడు వాడతాము.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Example</p>
                          <p className="text-sm font-semibold">I have a car.</p>
                          <p className="text-xs text-gray-500">నా దగ్గర ఒక కారు ఉంది.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Example</p>
                          <p className="text-sm font-semibold">He has a pen.</p>
                          <p className="text-xs text-gray-500">అతని దగ్గర ఒక పెన్ను ఉంది.</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Can Forms */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center text-sm">03</span>
                      Can Forms (can, cannot)
                    </h3>
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-gray-600">Used to show ability (something you can do).</p>
                      <p className="text-sm font-medium text-purple-800">🇮🇳 మనం ఏదైనా చేయగలము అని చెప్పేటప్పుడు వాడతాము.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Example</p>
                          <p className="text-sm font-semibold">I can speak English.</p>
                          <p className="text-xs text-gray-500">నేను ఇంగ్లీష్ మాట్లాడగలను.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Example</p>
                          <p className="text-sm font-semibold">I cannot swim.</p>
                          <p className="text-xs text-gray-500">నేను ఈత కొట్టలేను.</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Prepositions */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-sm">04</span>
                      Prepositions (in, on, at)
                    </h3>
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-gray-600">Used to show time and place.</p>
                      <p className="text-sm font-medium text-amber-800">🇮🇳 సమయం మరియు స్థలం గురించి చెప్పేటప్పుడు వాడతాము.</p>
                      <div className="space-y-2">
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-sm font-semibold"><span className="text-amber-600">In:</span> I am in the room.</p>
                          <p className="text-xs text-gray-500">నేను గదిలో ఉన్నాను.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-sm font-semibold"><span className="text-amber-600">On:</span> The book is on the table.</p>
                          <p className="text-xs text-gray-500">పుస్తకం టేబుల్ మీద ఉంది.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-sm font-semibold"><span className="text-amber-600">At:</span> I am at the office.</p>
                          <p className="text-xs text-gray-500">నేను ఆఫీసు వద్ద ఉన్నాను.</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Tenses */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-red-100 text-red-700 rounded-lg flex items-center justify-center text-sm">05</span>
                      Simple Tenses (Time)
                    </h3>
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-gray-600">How to talk about different times.</p>
                      <p className="text-sm font-medium text-red-800">🇮🇳 వివిధ సమయాల గురించి ఎలా మాట్లాడాలి.</p>
                      <div className="space-y-2">
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Past (నిన్న)</p>
                          <p className="text-sm font-semibold">I watched a movie.</p>
                          <p className="text-xs text-gray-500">నేను సినిమా చూశాను.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Present (ఈరోజు)</p>
                          <p className="text-sm font-semibold">I watch a movie.</p>
                          <p className="text-xs text-gray-500">నేను సినిమా చూస్తాను.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase">Future (రేపు)</p>
                          <p className="text-sm font-semibold">I will watch a movie.</p>
                          <p className="text-xs text-gray-500">నేను సినిమా చూస్తాను (భవిష్యత్తులో).</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100">
                  <button
                    onClick={() => setShowGuide(false)}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors"
                  >
                    Got it!
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (phase === 'completed') {
    const corrections = messages.filter(m => m.correction).map(m => m.correction!);
    
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-xl w-full bg-white rounded-3xl p-8 shadow-xl space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">Session Complete!</h2>
              <p className="text-gray-500">You practiced for 10 minutes today. Great job!</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Messages</p>
              <p className="text-2xl font-bold text-gray-900">{messages.length}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Corrections</p>
              <p className="text-2xl font-bold text-gray-900">{corrections.length}</p>
            </div>
          </div>

          {corrections.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Key Improvements
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {corrections.map((c, i) => (
                  <div key={i} className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2">
                    <div className="flex items-start gap-2 text-red-600 text-sm">
                      <span className="line-through opacity-60">{c.original}</span>
                    </div>
                    <div className="flex items-start gap-2 text-green-700 font-medium text-sm">
                      <span>{c.corrected}</span>
                    </div>
                    <p className="text-xs text-amber-800 italic border-t border-amber-200/50 pt-2">
                      {c.tip}
                    </p>
                    <p className="text-xs text-gray-600 font-medium">
                      🇮🇳 {c.telugu}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              What's Next?
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Consistency is key! Try to practice another scenario tomorrow to keep your momentum going.
            </p>
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
            Back to Scenarios
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
