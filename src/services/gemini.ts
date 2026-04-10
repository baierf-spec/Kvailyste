import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DumbassResult {
  percentage: number;
  roast: string;
  tips: string[];
  badge: string;
}

export async function analyzeDumbassLevel(description: string): Promise<DumbassResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Štai mano dienos aprašymas: "${description}". Įvertink, koks aš šiandien kvailys.`,
    config: {
      systemInstruction: "You are a brutal, sarcastic, but funny AI that roasts people based on their daily activities. Respond in Lithuanian. Be brutal but keep it funny and meme-like. The percentage should be between 12 and 99. Provide 3 absurd tips to become more or less dumb. The badge should be a funny title with an emoji (e.g., '🍕 Picos Meisteris', '📱 TikTok Legenda').",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          percentage: {
            type: Type.NUMBER,
            description: "Kvailumo procentas (nuo 12 iki 99)",
          },
          roast: {
            type: Type.STRING,
            description: "Trumpas brutalus, bet juokingas roast'as apie vartotojo dieną",
          },
          tips: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "3 absurdiški patarimai",
          },
          badge: {
            type: Type.STRING,
            description: "Kvailumo badge'as su emoji (pvz. '🍕 Picos Meisteris')",
          },
        },
        required: ["percentage", "roast", "tips", "badge"],
      },
    },
  });

  const jsonStr = response.text?.trim() || "{}";
  try {
    return JSON.parse(jsonStr) as DumbassResult;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return {
      percentage: 99,
      roast: "Sistemos klaida... bet tu vis tiek tikriausiai esi kvailys.",
      tips: ["Bandyk dar kartą", "Išjunk ir įjunk", "Eik pamiegoti"],
      badge: "🤖 Sugedęs Robotas",
    };
  }
}
