import { create } from 'zustand'

export type ModelId = 'nemotron' | 'qwen3' | 'mistral'

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  modelId?: ModelId
  streaming?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  selectedModel: ModelId
  isLoading: boolean
  setModel: (m: ModelId) => void
  addMessage: (msg: ChatMessage) => void
  appendToken: (id: string, token: string) => void
  finalizeStream: (id: string) => void
  setLoading: (v: boolean) => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  selectedModel: 'nemotron',
  isLoading: false,

  setModel: (m) => set({ selectedModel: m }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  appendToken: (id, token) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, text: m.text + token } : m,
      ),
    })),

  finalizeStream: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, streaming: false } : m,
      ),
    })),

  setLoading: (v) => set({ isLoading: v }),

  reset: () => set({ messages: [], isLoading: false }),
}))
