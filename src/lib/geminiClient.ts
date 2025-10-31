import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GOOGLE_AI_API_KEY!

if (!apiKey) {
  throw new Error('Missing Google AI API key')
}

export const genAI = new GoogleGenerativeAI(apiKey)

// Get the Gemini 1.5 Pro model
export const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
