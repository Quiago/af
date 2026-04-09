import { useRef, useState, useEffect } from 'react'
import './AIChatBubble.css'

interface Message {
  role: 'user' | 'ai'
  text: string
  ts: string
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'ai',
    text: '3 active inefficiencies detected. Zone CORE fan running at 856W during unoccupied hours. Apply the recommendations on the dashboard to capture AED 6,200 in annual savings.',
    ts: 'INAIA PRISM',
  },
]

export function AIChatBubble() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput]       = useState('')
  const msgsRef                 = useRef<HTMLDivElement>(null)

  // Listen for range-analysis requests from DebugTimelines charts
  useEffect(() => {
    function onAsk(e: Event) {
      const msg = (e as CustomEvent<{ message: string }>).detail.message
      setInput(msg)
      setOpen(true)
      // Scroll input into view after opening
      setTimeout(() => msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' }), 100)
    }
    window.addEventListener('inaia:ask', onAsk)
    return () => window.removeEventListener('inaia:ask', onAsk)
  }, [])

  function send() {
    const text = input.trim()
    if (!text) return

    setMessages((prev) => [...prev, { role: 'user', text, ts: 'YOU' }])
    setInput('')

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: 'Analyzing building data… Cross-referencing 24h sensor history with current simulation state to give you a specific recommendation.',
          ts: 'INAIA PRISM',
        },
      ])
      msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' })
    }, 600)

    setTimeout(() => {
      msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  return (
    <div className="ai-bubble">
      {open && (
        <div className="ai-window">
          <div className="ai-whead">
            <span className="ai-wtitle">✦ INAIA Prism</span>
            <button className="ai-wclose" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="ai-msgs" ref={msgsRef}>
            {messages.map((m, i) => (
              <div key={i} className={`am ${m.role === 'user' ? 'am--user' : 'am--ai'}`}>
                <span className="am-who">{m.ts}</span>
                <div className="am-body">{m.text}</div>
              </div>
            ))}
          </div>
          <div className="ai-bar">
            <input
              className="ai-in"
              placeholder="Ask about your building…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            />
            <button className="ai-send" onClick={send}>↑</button>
          </div>
        </div>
      )}
      <button className="ai-btn" onClick={() => setOpen((v) => !v)} title="INAIA Prism AI">
        ✦
      </button>
    </div>
  )
}
