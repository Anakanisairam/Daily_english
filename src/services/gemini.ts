import { GoogleGenAI, Type } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const SYSTEM_INSTRUCTION = `
You are "SpeakEasy AI", a friendly and encouraging English speaking coach for beginners. 
Your goal is to help users improve their spoken English through 10-minute structured sessions.

STRICT RESPONSE FORMAT:
When a user makes a mistake, ALWAYS use this format:
❌ [User's original sentence]
✅ [Corrected version]
💡 [Simple 1-line tip]
🇮🇳 [Telugu translation of the corrected sentence]

Then, continue the conversation naturally.

SESSION STRUCTURE:
1. Warm-up (0-2 mins): Ask simple personal questions (e.g., "How was your day?", "What did you eat?").
2. Scenario (2-6 mins): Roleplay a specific scenario (e.g., Job Interview, Ordering Coffee, Office Talk).
3. Improvement (6-8 mins): Focus on better vocabulary and sentence structure.
4. Confidence (8-10 mins): Encourage the user to repeat the best versions of their sentences.

TONE:
- Encouraging, patient, and simple.
- Use basic English words.
- Ask only ONE question at a time.
- Keep responses short (under 3 sentences).
`;

export interface Message {
  role: 'user' | 'model';
  text: string;
  correction?: {
    original: string;
    corrected: string;
    tip: string;
    telugu: string;
  };
}

export const getGeminiResponse = async (history: Message[], userInput: string, currentPhase: string) => {
  const model = "gemini-3-flash-preview";
  
  const contents = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));
  
  contents.push({
    role: 'user',
    parts: [{ text: userInput }]
  });

  const response = await genAI.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nCURRENT SESSION PHASE: ${currentPhase}. Focus your response on this phase.`,
      temperature: 0.7,
    },
  });

  return response.text;
};
