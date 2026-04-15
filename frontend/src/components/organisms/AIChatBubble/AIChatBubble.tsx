import { useRef, useState, useEffect, useCallback } from 'react'
import OpenAI from 'openai'
import { useChatStore, type ModelId } from '../../../store/chatStore'
import './AIChatBubble.css'

// ─── Model personas ────────────────────────────────────────────────────────────

const MODELS: Record<ModelId, { label: string; sub: string; avatar: string; systemPrompt: string }> = {
  nemotron: {
    label: 'Nemotron-70B',
    sub: 'NVIDIA',
    avatar: '⬡',
    systemPrompt:
      `You are Nemotron-70B, NVIDIA's high-performance language model optimised for enterprise ` +
      `reasoning and HVAC/energy domain knowledge. You are an expert in building energy optimisation, ` +
      `BOPTEST simulation, thermal comfort, and smart building systems. Keep answers concise and ` +
      `actionable. Never mention OpenAI, GPT, or any underlying API. Always identify as Nemotron-70B.`,
  },
  qwen3: {
    label: 'Qwen3-235B',
    sub: 'Alibaba',
    avatar: '◈',
    systemPrompt:
      `You are Qwen3-235B, Alibaba Cloud's flagship 235-billion-parameter reasoning model. ` +
      `You are an expert in building energy optimisation, HVAC systems, and real-time sensor analytics. ` +
      `Keep answers concise and actionable. Never mention OpenAI, GPT, or any underlying API. ` +
      `Always identify as Qwen3-235B.`,
  },
  mistral: {
    label: 'Mistral Large 2',
    sub: 'Mistral AI',
    avatar: '◎',
    systemPrompt:
      `You are Mistral Large 2, Mistral AI's most capable flagship model. You specialise in ` +
      `building energy management, thermal comfort analysis, and HVAC optimisation. Keep answers ` +
      `concise and actionable. Never mention OpenAI, GPT, or any underlying API. Always identify ` +
      `as Mistral Large 2.`,
  },
}

const QUICK_PROMPTS = [
  { icon: '⚡', text: 'Why is CORE zone overheating?' },
  { icon: '📊', text: 'Summarise today\'s KPIs' },
  { icon: '💡', text: 'Best energy-saving action right now' },
]

// ─── Main component ────────────────────────────────────────────────────────────

export function AIChatBubble() {
  const [open,          setOpen]          = useState(false)
  const [modelOpen,     setModelOpen]     = useState(false)
  const [input,         setInput]         = useState('')
  const msgsRef   = useRef<HTMLDivElement>(null)
  const textaRef  = useRef<HTMLTextAreaElement>(null)
  const dropRef   = useRef<HTMLDivElement>(null)

  const messages       = useChatStore((s) => s.messages)
  const selectedModel  = useChatStore((s) => s.selectedModel)
  const isLoading      = useChatStore((s) => s.isLoading)
  const { setModel, addMessage, appendToken, finalizeStream, setLoading, reset } = useChatStore.getState()

  // ── Listen for inaia:ask event ───────────────────────────────────────────
  useEffect(() => {
    function onAsk(e: Event) {
      const msg = (e as CustomEvent<{ message: string }>).detail.message
      setInput(msg)
      setOpen(true)
      setTimeout(() => textaRef.current?.focus(), 120)
    }
    window.addEventListener('inaia:ask', onAsk)
    return () => window.removeEventListener('inaia:ask', onAsk)
  }, [])

  // ── Auto-scroll on new messages ──────────────────────────────────────────
  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // ── Close model dropdown when clicking outside ───────────────────────────
  useEffect(() => {
    if (!modelOpen) return
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setModelOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [modelOpen])

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim()
    if (!userText || isLoading) return

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
    if (!apiKey) {
      addMessage({ id: crypto.randomUUID(), role: 'user', text: userText })
      addMessage({
        id: crypto.randomUUID(),
        role: 'ai',
        text: 'API key not configured. Set VITE_OPENAI_API_KEY in your environment.',
        modelId: selectedModel,
      })
      return
    }

    const persona = MODELS[selectedModel]

    addMessage({ id: crypto.randomUUID(), role: 'user', text: userText })

    const aiId = crypto.randomUUID()
    addMessage({ id: aiId, role: 'ai', text: '', modelId: selectedModel, streaming: true })
    setLoading(true)

    try {
      const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

      // Build conversation history (last 10 turns, excluding still-streaming)
      const history = useChatStore.getState().messages
        .filter((m) => !m.streaming && m.text)
        .slice(-10)
        .map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        }))

      const stream = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: persona.systemPrompt },
          ...history,
          { role: 'user', content: userText },
        ],
        max_tokens: 400,
        temperature: 0.7,
      })

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? ''
        if (token) appendToken(aiId, token)
      }
    } catch (err) {
      appendToken(aiId, `\n\n[Error: ${err instanceof Error ? err.message : 'Unknown error'}]`)
    } finally {
      finalizeStream(aiId)
      setLoading(false)
    }
  }, [isLoading, selectedModel, addMessage, appendToken, finalizeStream, setLoading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
      setInput('')
    }
  }

  function handleSend() {
    sendMessage(input)
    setInput('')
  }

  const persona = MODELS[selectedModel]
  const isEmpty = messages.length === 0

  return (
    <div className="ai-bubble">

      {open && (
        <div className="ai-window">

          {/* ── Header ───────────────────────────────────────────────── */}
          <div className="ai-head">
            <span className="ai-head-title">✦ INAIA Prism</span>

            <div className="ai-head-right">
              {/* Model selector */}
              <div className="ai-model-wrap" ref={dropRef}>
                <button
                  className="ai-model-pill"
                  onClick={() => setModelOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={modelOpen}
                >
                  <span className="ai-model-avatar">{persona.avatar}</span>
                  <span className="ai-model-label">{persona.label}</span>
                  <span className="ai-model-caret">▾</span>
                </button>

                {modelOpen && (
                  <div className="ai-model-dropdown" role="listbox">
                    {(Object.entries(MODELS) as [ModelId, typeof MODELS[ModelId]][]).map(([id, m]) => (
                      <button
                        key={id}
                        role="option"
                        aria-selected={id === selectedModel}
                        className={`ai-model-option ${id === selectedModel ? 'ai-model-option--active' : ''}`}
                        onClick={() => { setModel(id); setModelOpen(false) }}
                      >
                        <span className="ai-model-opt-avatar">{m.avatar}</span>
                        <span className="ai-model-opt-info">
                          <span className="ai-model-opt-label">{m.label}</span>
                          <span className="ai-model-opt-sub">{m.sub}</span>
                        </span>
                        {id === selectedModel && <span className="ai-model-opt-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* New chat */}
              <button
                className="ai-head-btn"
                onClick={reset}
                title="New chat"
                aria-label="New chat"
              >+</button>

              {/* Close */}
              <button
                className="ai-head-btn"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >✕</button>
            </div>
          </div>

          {/* ── Body ─────────────────────────────────────────────────── */}
          <div className="ai-msgs" ref={msgsRef}>
            {isEmpty ? (
              <div className="ai-empty">
                <div className="ai-empty-avatar">{persona.avatar}</div>
                <div className="ai-empty-name">INAIA Prism</div>
                <div className="ai-empty-sub">Ask anything about your building</div>
                <div className="ai-quick-chips">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q.text}
                      className="ai-chip"
                      onClick={() => { sendMessage(q.text) }}
                    >
                      <span>{q.icon}</span>
                      <span>{q.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`am am--${m.role}`}>
                  {m.role === 'ai' && m.modelId && (
                    <div className="am-meta">
                      <span className="am-avatar">{MODELS[m.modelId].avatar}</span>
                      <span className="am-who">{MODELS[m.modelId].label}</span>
                    </div>
                  )}
                  {m.role === 'user' && (
                    <div className="am-meta am-meta--user">
                      <span className="am-who">YOU</span>
                    </div>
                  )}
                  <div className={`am-body ${m.streaming ? 'am-body--streaming' : ''}`}>
                    {m.text || (m.streaming ? '' : '…')}
                  </div>
                </div>
              ))
            )}

            {/* Loading dots when waiting for first token */}
            {isLoading && messages.at(-1)?.streaming && messages.at(-1)?.text === '' && (
              <div className="ai-typing">
                <span /><span /><span />
              </div>
            )}
          </div>

          {/* ── Input bar ────────────────────────────────────────────── */}
          <div className="ai-bar">
            <textarea
              ref={textaRef}
              className="ai-textarea"
              placeholder="Ask about your building…"
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              className={`ai-send ${isLoading ? 'ai-send--disabled' : ''}`}
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              aria-label="Send"
            >↑</button>
          </div>

        </div>
      )}

      <button
        className="ai-btn"
        onClick={() => setOpen((v) => !v)}
        title="INAIA Prism AI"
        aria-label="Open AI assistant"
      >✦</button>

    </div>
  )
}
