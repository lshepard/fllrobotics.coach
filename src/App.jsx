import { useState, useRef, useEffect } from 'react'
import { useConversation } from '@elevenlabs/react'
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
  const [messages, setMessages] = useState([{ text: 'Click the coach to start your session...', type: 'system' }])
  const [error, setError] = useState(null)
  const [messageInput, setMessageInput] = useState('')
  const [volume, setVolume] = useState(100)

  const messagesEndRef = useRef(null)

  const conversation = useConversation({
    onConnect: () => {
      addMessage('Connected! Your coach is ready to help.', 'system')
    },
    onDisconnect: () => {
      addMessage('Session ended.', 'system')
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
    }
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const addMessage = (text, type) => {
    setMessages(prev => [...prev, { text, type }])
  }

  const showError = (message) => {
    setError(message)
    setTimeout(() => setError(null), 5000)
  }

  const getStatus = () => {
    if (conversation.status === 'connected') {
      return conversation.isSpeaking ? 'Coach is speaking...' : 'Coach is listening...'
    } else if (conversation.status === 'connecting') {
      return 'Connecting...'
    }
    return 'Ready to help'
  }

  const getStatusType = () => {
    if (conversation.status === 'connected') return 'connected'
    if (conversation.status === 'connecting') return 'connecting'
    return 'disconnected'
  }

  const startConversation = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      addMessage('Connecting to your coach...', 'system')
      await conversation.startSession({ agentId: AGENT_ID })
    } catch (error) {
      console.error('Failed to start conversation:', error)
      showError(`Failed to start: ${error.message}`)
    }
  }

  const endConversation = async () => {
    try {
      await conversation.endSession()
    } catch (error) {
      console.error('Failed to end conversation:', error)
      showError(`Failed to end session: ${error.message}`)
    }
  }

  const toggleMute = () => {
    try {
      conversation.setMuted(!conversation.isMuted)
      addMessage(conversation.isMuted ? 'Microphone muted' : 'Microphone unmuted', 'system')
    } catch (error) {
      console.error('Failed to toggle mute:', error)
      showError(`Failed to toggle mute: ${error.message}`)
    }
  }

  const sendMessage = async () => {
    const message = messageInput.trim()
    if (message && conversation.status === 'connected') {
      try {
        await conversation.sendUserMessage(message)
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
    try {
      conversation.setVolume(volumeValue / 100)
    } catch (error) {
      console.error('Failed to set volume:', error)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && conversation.status === 'connected') {
      sendMessage()
    }
  }

  const isConnected = conversation.status === 'connected'

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
            className={`agent-circle ${getStatusType()}`}
            onClick={!isConnected ? startConversation : null}
            style={{ cursor: !isConnected ? 'pointer' : 'default' }}
          >
            <div className="agent-icon">🤖</div>
            <div className="agent-status">{getStatus()}</div>
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
              className={`btn-secondary ${conversation.isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
              disabled={!isConnected}
            >
              {conversation.isMuted ? '🔇 Unmute' : '🎤 Mute'}
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
