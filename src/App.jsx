import { useState, useRef, useEffect } from 'react'
import { Conversation } from '@elevenlabs/client'
import './App.css'

const AGENT_ID = "agent_01jvcwy4xseqg8qjgw6wbgsywd"

const rubricData = [
  {
    category: "IDENTIFY",
    description: "Team had a clearly defined problem that was well researched.",
    elements: [
      "Clear definition of the problem",
      "Clear, detailed research from a variety of sources"
    ]
  },
  {
    category: "DESIGN",
    description: "Team worked together while creating a project plan and developing their ideas.",
    elements: [
      "Clear evidence of an effective project plan",
      "Clear evidence that development process involved all team members"
    ]
  },
  {
    category: "CREATE",
    description: "Team developed an original idea or built on an existing one with a prototype model/drawing to represent their solution.",
    elements: [
      "Detailed explanation of innovation in solution",
      "Detailed model or drawing that represents the solution"
    ]
  },
  {
    category: "ITERATE",
    description: "Team shared their ideas with others, collected feedback, and included improvements to their solution.",
    elements: [
      "Solution shared with multiple people/groups",
      "Clear evidence of improvements based on feedback"
    ]
  },
  {
    category: "COMMUNICATE",
    description: "Team shared an effective presentation of their solution, its impact on others, and celebrated their team's progress.",
    elements: [
      "Clear explanation of solution and its potential impact on others",
      "Presentation clearly shows pride or enthusiasm for their work"
    ]
  }
]

function App() {
  const [status, setStatus] = useState({ text: 'Ready to help', type: 'disconnected' })
  const [messages, setMessages] = useState([{ text: 'Click the coach to start your session...', type: 'system' }])
  const [error, setError] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(100)
  const [messageInput, setMessageInput] = useState('')

  const conversationRef = useRef(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        conversationRef.current.endSession()
      }
    }
  }, [])

  const addMessage = (text, type) => {
    setMessages(prev => [...prev, { text, type }])
  }

  const showError = (message) => {
    setError(message)
    setTimeout(() => setError(null), 5000)
  }

  const updateStatus = (text, type) => {
    setStatus({ text, type })
  }

  const startConversation = async () => {
    try {
      updateStatus('Requesting microphone access...', 'connecting')

      await navigator.mediaDevices.getUserMedia({ audio: true })

      updateStatus('Connecting...', 'connecting')
      addMessage('Connecting to your coach...', 'system')

      conversationRef.current = await Conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'webrtc',

        onConnect: () => {
          updateStatus('Coach is listening', 'connected')
          addMessage('Connected! Your coach is ready to help.', 'system')
          setIsConnected(true)
        },

        onDisconnect: () => {
          updateStatus('Session ended', 'disconnected')
          addMessage('Session ended.', 'system')
          setIsConnected(false)
          conversationRef.current = null
        },

        onMessage: (message) => {
          console.log('Message received:', message)
          if (message.type === 'user_transcript') {
            addMessage(`You: ${message.message}`, 'user')
          } else if (message.type === 'agent_response') {
            addMessage(`Coach: ${message.message}`, 'agent')
          }
        },

        onError: (error) => {
          console.error('Conversation error:', error)
          showError(`Error: ${error.message || 'An error occurred'}`)
        },

        onStatusChange: (status) => {
          console.log('Status changed:', status)
        },

        onModeChange: (mode) => {
          console.log('Mode changed:', mode)
          if (mode.mode === 'speaking') {
            updateStatus('Coach is speaking...', 'connected')
          } else if (mode.mode === 'listening') {
            updateStatus('Coach is listening...', 'connected')
          }
        }
      })

    } catch (error) {
      console.error('Failed to start conversation:', error)
      showError(`Failed to start: ${error.message}`)
      updateStatus('Connection failed', 'disconnected')
    }
  }

  const endConversation = async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.endSession()
        conversationRef.current = null
        updateStatus('Session ended', 'disconnected')
      } catch (error) {
        console.error('Failed to end conversation:', error)
        showError(`Failed to end session: ${error.message}`)
      }
    }
  }

  const toggleMute = async () => {
    if (conversationRef.current) {
      try {
        const newMutedState = !isMuted
        await conversationRef.current.setMicMuted(newMutedState)
        setIsMuted(newMutedState)
        addMessage(newMutedState ? 'Microphone muted' : 'Microphone unmuted', 'system')
      } catch (error) {
        console.error('Failed to toggle mute:', error)
        showError(`Failed to toggle mute: ${error.message}`)
      }
    }
  }

  const sendMessage = async () => {
    const message = messageInput.trim()
    if (message && conversationRef.current) {
      try {
        await conversationRef.current.sendUserMessage(message)
        addMessage(`You: ${message}`, 'user')
        setMessageInput('')
      } catch (error) {
        console.error('Failed to send message:', error)
        showError(`Failed to send message: ${error.message}`)
      }
    }
  }

  const handleVolumeChange = (value) => {
    const volumeValue = parseInt(value)
    setVolume(volumeValue)
    if (conversationRef.current) {
      try {
        conversationRef.current.setVolume({ volume: volumeValue / 100 })
      } catch (error) {
        console.error('Failed to set volume:', error)
      }
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && isConnected) {
      sendMessage()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>FIRST LEGO League Innovation Project Coach</h1>
          <p className="subtitle">AI-Powered Coaching for Your Innovation Project</p>
        </div>
      </header>

      <div className="container">
        {/* Agent Interface Section */}
        <div className="agent-section">
          <div
            className={`agent-circle ${status.type}`}
            onClick={!isConnected ? startConversation : null}
            style={{ cursor: !isConnected ? 'pointer' : 'default' }}
          >
            <div className="agent-icon">🤖</div>
            <div className="agent-status">{status.text}</div>
          </div>

          {error && (
            <div className="error show">
              {error}
            </div>
          )}

          <div className="controls">
            <button
              className="btn-primary"
              onClick={startConversation}
              disabled={isConnected}
            >
              Start Session
            </button>
            <button
              className="btn-secondary"
              onClick={endConversation}
              disabled={!isConnected}
            >
              End Session
            </button>
            <button
              className={`btn-secondary ${isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
              disabled={!isConnected}
            >
              {isMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>
          </div>

          <div className="volume-control">
            <label htmlFor="volumeSlider">
              Volume: <span>{volume}%</span>
            </label>
            <input
              type="range"
              id="volumeSlider"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(e.target.value)}
            />
          </div>

          <div className="message-input">
            <input
              type="text"
              placeholder="Type a message to your coach..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected}
            />
            <button
              className="btn-send"
              onClick={sendMessage}
              disabled={!isConnected}
            >
              Send
            </button>
          </div>

          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.type}`}>
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Rubric Section */}
        <div className="rubric-section">
          <div className="rubric-header">
            <h2>Innovation Project Rubric</h2>
            <a
              href="https://firstinspires.blob.core.windows.net/fll/challenge/2025-26/fll-challenge-unearthed-rubrics-color.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="rubric-link"
            >
              View Official Rubric PDF
            </a>
          </div>

          <div className="rubric-table">
            {rubricData.map((section, idx) => (
              <div key={idx} className="rubric-category">
                <div className="category-header">
                  <h3>{section.category}</h3>
                  <p>{section.description}</p>
                </div>
                <div className="category-elements">
                  {section.elements.map((element, elemIdx) => (
                    <div key={elemIdx} className="rubric-element">
                      <span className="element-checkbox">☐</span>
                      <span className="element-text">{element}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>FIRST® LEGO® League is a registered trademark of FIRST®</p>
      </footer>
    </div>
  )
}

export default App
