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
  { icon: '📊', text: "Summarise today's KPIs" },
  { icon: '💡', text: 'Best energy-saving action right now' },
]

const ACCEPTED_TYPES = '.txt,.md,.csv,.json,.js,.ts,.tsx,.py,.html,.yaml,.yml,.log'
const MAX_FILE_BYTES = 120_000  // ~120 KB — keep prompts manageable

interface AttachedFile { name: string; content: string }

// ─── Main component ────────────────────────────────────────────────────────────

export function AIChatBubble() {
  const [open,         setOpen]        = useState(false)
  const [modelOpen,    setModelOpen]   = useState(false)
  const [input,        setInput]       = useState('')
  const [attached,     setAttached]    = useState<AttachedFile | null>(null)
  const [fileError,    setFileError]   = useState<string | null>(null)

  const msgsRef  = useRef<HTMLDivElement>(null)
  const textaRef = useRef<HTMLTextAreaElement>(null)
  const dropRef  = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  const messages      = useChatStore((s) => s.messages)
  const selectedModel = useChatStore((s) => s.selectedModel)
  const isLoading     = useChatStore((s) => s.isLoading)
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

  // ── File attachment ──────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File too large (max ${MAX_FILE_BYTES / 1000} KB)`)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAttached({ name: file.name, content: ev.target?.result as string })
    }
    reader.onerror = () => setFileError('Could not read file')
    reader.readAsText(file)
    e.target.value = ''  // reset so same file can be re-selected
  }

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, file?: AttachedFile | null) => {
    const userText = text.trim()
    if (!userText || isLoading) return

    // Compose user content: prepend doc context if attached
    const docContext = file
      ? `[Attached document: ${file.name}]\n\n${file.content}\n\n---\n\n`
      : ''
    const fullUserContent = docContext + userText

    // Display label — show file name as a prefix in the bubble
    const displayText = file ? `📎 ${file.name}\n\n${userText}` : userText

    setAttached(null)

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
    if (!apiKey) {
      addMessage({ id: crypto.randomUUID(), role: 'user', text: displayText })
      addMessage({
        id: crypto.randomUUID(),
        role: 'ai',
        text: 'API key not configured. Set VITE_OPENAI_API_KEY in your environment.',
        modelId: selectedModel,
      })
      return
    }

    const persona = MODELS[selectedModel]
    addMessage({ id: crypto.randomUUID(), role: 'user', text: displayText })

    const aiId = crypto.randomUUID()
    addMessage({ id: aiId, role: 'ai', text: '', modelId: selectedModel, streaming: true })
    setLoading(true)

    try {
      const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

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
          { role: 'user', content: fullUserContent },
        ],
        max_tokens: 600,
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
      sendMessage(input, attached)
      setInput('')
    }
  }

  function handleSend() {
    sendMessage(input, attached)
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
              <button className="ai-head-btn" onClick={reset} title="New chat" aria-label="New chat">+</button>
              <button className="ai-head-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
          </div>

          {/* ── Messages ─────────────────────────────────────────────── */}
          <div className="ai-msgs" ref={msgsRef}>
            {isEmpty ? (
              <div className="ai-empty">
                <div className="ai-empty-avatar">{persona.avatar}</div>
                <div className="ai-empty-name">INAIA Prism</div>
                <div className="ai-empty-sub">Ask anything about your building</div>
                <div className="ai-quick-chips">
                  {QUICK_PROMPTS.map((q) => (
                    <button key={q.text} className="ai-chip" onClick={() => sendMessage(q.text)}>
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

            {isLoading && messages.at(-1)?.streaming && messages.at(-1)?.text === '' && (
              <div className="ai-typing"><span /><span /><span /></div>
            )}
          </div>

          {/* ── Input box ────────────────────────────────────────────── */}
          <div className="ai-bar">

            {/* Attached file pill */}
            {attached && (
              <div className="ai-file-pill">
                <span className="ai-file-icon">📎</span>
                <span className="ai-file-name">{attached.name}</span>
                <button className="ai-file-remove" onClick={() => setAttached(null)} aria-label="Remove file">✕</button>
              </div>
            )}
            {fileError && (
              <div className="ai-file-error">{fileError}</div>
            )}

            {/* Textarea */}
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

            {/* Toolbar row */}
            <div className="ai-toolbar">
              <div className="ai-toolbar-left">

                {/* Clip button */}
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="ai-file-input"
                  onChange={handleFileChange}
                  aria-label="Attach document"
                />
                <button
                  className="ai-tool-btn"
                  onClick={() => fileRef.current?.click()}
                  title="Attach document"
                  aria-label="Attach document"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.34a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>

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

              </div>

              {/* Send */}
              <button
                className={`ai-send ${isLoading || !input.trim() ? 'ai-send--disabled' : ''}`}
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                aria-label="Send"
              >↑</button>
            </div>

          </div>

        </div>
      )}

      <button className="ai-btn" onClick={() => setOpen((v) => !v)} title="INAIA Prism AI" aria-label="Open AI assistant">
        ✦
      </button>

    </div>
  )
}
