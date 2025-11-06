import { useState, useRef, useEffect } from 'react'
import { Conversation } from '@elevenlabs/client'
import './App.css'

const AGENT_ID = "agent_01jvcwy4xseqg8qjgw6wbgsywd"

function App() {
  const [status, setStatus] = useState({ text: 'Disconnected', type: 'disconnected' })
  const [messages, setMessages] = useState([{ text: 'Ready to start conversation...', type: 'system' }])
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

      updateStatus('Connecting to agent...', 'connecting')
      addMessage('Connecting to voice agent...', 'system')

      conversationRef.current = await Conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'webrtc',

        onConnect: () => {
          updateStatus('Connected - Agent is listening', 'connected')
          addMessage('Connected! You can now speak to the agent.', 'system')
          setIsConnected(true)
        },

        onDisconnect: () => {
          updateStatus('Disconnected', 'disconnected')
          addMessage('Disconnected from agent.', 'system')
          setIsConnected(false)
          conversationRef.current = null
        },

        onMessage: (message) => {
          console.log('Message received:', message)
          if (message.type === 'user_transcript') {
            addMessage(`You: ${message.message}`, 'user')
          } else if (message.type === 'agent_response') {
            addMessage(`Agent: ${message.message}`, 'agent')
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
            updateStatus('Agent is speaking...', 'connected')
          } else if (mode.mode === 'listening') {
            updateStatus('Agent is listening...', 'connected')
          }
        }
      })

    } catch (error) {
      console.error('Failed to start conversation:', error)
      showError(`Failed to start: ${error.message}`)
      updateStatus('Failed to connect', 'disconnected')
    }
  }

  const endConversation = async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.endSession()
        conversationRef.current = null
        updateStatus('Disconnected', 'disconnected')
      } catch (error) {
        console.error('Failed to end conversation:', error)
        showError(`Failed to end conversation: ${error.message}`)
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
        addMessage(`You (text): ${message}`, 'user')
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
      <div className="container">
        <h1>🎙️ Voice Agent</h1>

        <div className={`status ${status.type}`}>
          {status.text}
        </div>

        {error && (
          <div className="error show">
            {error}
          </div>
        )}

        <div className="controls">
          <button
            className="btn-start"
            onClick={startConversation}
            disabled={isConnected}
          >
            Start Conversation
          </button>
          <button
            className="btn-end"
            onClick={endConversation}
            disabled={!isConnected}
          >
            End Conversation
          </button>
          <button
            className={isMuted ? 'btn-unmute' : 'btn-mute'}
            onClick={toggleMute}
            disabled={!isConnected}
          >
            {isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          </button>
        </div>

        <div className="volume-control">
          <label htmlFor="volumeSlider">
            Agent Volume: <span>{volume}%</span>
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
            placeholder="Type a message to the agent..."
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
    </div>
  )
}

export default App
