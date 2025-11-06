"use client";

import { useState, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import {
  Conversation,
  ConversationContent,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";

const AGENT_ID = "agent_01jvcwy4xseqg8qjgw6wbgsywd";

const rubricData = [
  {
    category: "IDENTIFY",
    description:
      "Team had a clearly defined problem that was well researched.",
    elements: [
      "Clear definition of the problem",
      "Clear, detailed research from a variety of sources",
    ],
  },
  {
    category: "DESIGN",
    description:
      "Team worked together while creating a project plan and developing their ideas.",
    elements: [
      "Clear evidence of an effective project plan",
      "Clear evidence that development process involved all team members",
    ],
  },
  {
    category: "CREATE",
    description:
      "Team developed an original idea or built on an existing one with a prototype model/drawing to represent their solution.",
    elements: [
      "Detailed explanation of innovation in solution",
      "Detailed model or drawing that represents the solution",
    ],
  },
  {
    category: "ITERATE",
    description:
      "Team shared their ideas with others, collected feedback, and included improvements to their solution.",
    elements: [
      "Solution shared with multiple people/groups",
      "Clear evidence of improvements based on feedback",
    ],
  },
  {
    category: "COMMUNICATE",
    description:
      "Team shared an effective presentation of their solution, its impact on others, and celebrated their team's progress.",
    elements: [
      "Clear explanation of solution and its potential impact on others",
      "Presentation clearly shows pride or enthusiasm for their work",
    ],
  },
];

interface ConversationMessage {
  from: "user" | "assistant";
  text: string;
}

export default function Home() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userMediaStream, setUserMediaStream] = useState<MediaStream | null>(null);
  const agentMediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [, forceUpdate] = useState({});

  const conversation = useConversation({
    agentId: AGENT_ID,
    onConnect: () => {
      console.log("Connected");
    },
    onDisconnect: () => {
      console.log("Disconnected");
    },
    onMessage: (message) => {
      console.log("Message received:", message);
      if (message.source === "user") {
        setMessages((prev) => [
          ...prev,
          { from: "user", text: message.message },
        ]);
      } else if (message.source === "ai") {
        setMessages((prev) => [
          ...prev,
          { from: "assistant", text: message.message },
        ]);
      }
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      setError(typeof error === 'string' ? error : "An error occurred");
      setTimeout(() => setError(null), 5000);
    },
  });

  const startConversation = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setUserMediaStream(stream);
      // @ts-expect-error - Type incompatibility with @elevenlabs/react
      await conversation.startSession();
    } catch (error: unknown) {
      console.error("Failed to start conversation:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to start: ${message}`);
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
      // Clean up user media stream
      if (userMediaStream) {
        userMediaStream.getTracks().forEach(track => track.stop());
        setUserMediaStream(null);
      }
      // Clean up agent media stream
      if (agentMediaStreamRef.current) {
        agentMediaStreamRef.current.getTracks().forEach(track => track.stop());
        agentMediaStreamRef.current = null;
      }
      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (error: unknown) {
      console.error("Failed to end conversation:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to end session: ${message}`);
    }
  };

  const getStatusText = () => {
    if (conversation.status === "connected") {
      return conversation.isSpeaking ? "Speaking..." : "Listening...";
    } else if (conversation.status === "connecting") {
      return "Connecting...";
    }
    return "Ready";
  };

  const isConnected = conversation.status === "connected";
  const agentState: "speaking" | "listening" | undefined = conversation.status === "connected"
    ? (conversation.isSpeaking ? "speaking" : "listening")
    : undefined;

  // Effect to capture agent's audio output
  useEffect(() => {
    console.log('🔍 Audio capture effect running. isConnected:', isConnected);

    if (!isConnected) {
      console.log('❌ Not connected, skipping audio capture');
      return;
    }

    // Try to find the audio element created by ElevenLabs
    const findAndCaptureAudio = () => {
      const audioElements = document.querySelectorAll('audio');
      console.log('🔊 Found', audioElements.length, 'audio elements in DOM');

      for (const audio of audioElements) {
        console.log('🎵 Checking audio element:', {
          src: audio.src,
          srcObject: audio.srcObject,
          paused: audio.paused,
          currentTime: audio.currentTime
        });

        // Check if this audio element is actively playing or has a source
        if (audio.src || audio.srcObject) {
          try {
            // Create audio context if it doesn't exist
            if (!audioContextRef.current) {
              const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
              audioContextRef.current = new AudioContextClass();
              console.log('✅ Created AudioContext');
            }

            // Create a media stream destination
            const destination = audioContextRef.current.createMediaStreamDestination();
            console.log('✅ Created MediaStreamDestination');

            // Create source from audio element
            const source = audioContextRef.current.createMediaElementSource(audio);
            console.log('✅ Created MediaElementSource');

            // Connect to both destination (for capture) and context destination (for playback)
            source.connect(destination);
            source.connect(audioContextRef.current.destination);
            console.log('✅ Connected audio nodes');

            // Store the audio element and stream
            audioElementRef.current = audio;
            agentMediaStreamRef.current = destination.stream;
            forceUpdate({}); // Force re-render to update visualizer
            console.log('✅ Set agentMediaStream:', destination.stream);

            return true;
          } catch (err) {
            console.warn('❌ Failed to capture audio element:', err);
          }
        }
      }
      console.log('❌ No suitable audio element found');
      return false;
    };

    // Try immediately
    if (!findAndCaptureAudio()) {
      console.log('⏳ Audio element not found, retrying in 500ms...');
      // If not found, try again after a short delay
      const timeoutId = setTimeout(() => {
        console.log('🔄 Retrying audio capture...');
        findAndCaptureAudio();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isConnected]);

  // Use user's microphone stream when listening, agent's audio when speaking
  const visualizerStream = conversation.status === "connected"
    ? (conversation.isSpeaking ? agentMediaStreamRef.current : userMediaStream)
    : null;

  // Debug visualizer stream selection
  useEffect(() => {
    console.log('📊 Visualizer stream selection:', {
      conversationStatus: conversation.status,
      isSpeaking: conversation.isSpeaking,
      agentState,
      hasAgentMediaStream: !!agentMediaStreamRef.current,
      hasUserMediaStream: !!userMediaStream,
      selectedStream: conversation.isSpeaking ? 'agentMediaStream' : 'userMediaStream',
      visualizerStream: visualizerStream,
      agentStreamId: agentMediaStreamRef.current?.id
    });
  }, [conversation.status, conversation.isSpeaking, agentState, userMediaStream, visualizerStream]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Background */}
      <div
        className="relative bg-white shadow-lg overflow-hidden"
        style={{
          backgroundImage: "url(/project-team-presenting.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: "60vh",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0066B3]/95 via-[#0066B3]/90 to-white/95"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-3">
              FIRST LEGO League Innovation Project Coach
            </h1>
            <p className="text-lg text-white/95">
              AI-Powered Coaching for Your Innovation Project
            </p>
          </div>

          {error && (
            <div className="max-w-2xl mx-auto mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Interactive Coach Area - Click to Start */}
          <div
            className="max-w-3xl mx-auto"
            onClick={() => {
              if (!isConnected) {
                startConversation();
              }
            }}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !isConnected) {
                startConversation();
              }
            }}
          >
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
              {/* BarVisualizer - Prominent and Visible */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-full max-w-xl">
                  <BarVisualizer
                    state={agentState}
                    barCount={20}
                    mediaStream={visualizerStream}
                    minHeight={10}
                    maxHeight={95}
                    className="w-full h-48 bg-gray-100 border-2 border-[#0066B3]/20"
                  />
                </div>
                <div className="mt-6 text-center">
                  <p className="text-2xl font-semibold text-gray-800">
                    {getStatusText()}
                  </p>
                  {!isConnected && (
                    <p className="text-sm text-gray-500 mt-2">
                      Click anywhere to start your coaching session
                    </p>
                  )}
                  {isConnected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        endConversation();
                      }}
                      className="mt-3 px-6 py-2 bg-[#ED1C24] text-white rounded-lg font-medium hover:bg-[#C41E3A] transition"
                    >
                      End Session
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Conversation Display */}
          {isConnected && (
            <div className="max-w-3xl mx-auto mt-6">
              <Conversation className="h-96 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#0066B3]/20">
                <ConversationContent>
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      Start talking with your coach...
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <Message key={idx} from={msg.from}>
                        <MessageContent>{msg.text}</MessageContent>
                      </Message>
                    ))
                  )}
                </ConversationContent>
              </Conversation>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Rubric Section */}
        <div className="bg-white rounded-2xl p-8 shadow-md">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h2 className="text-2xl font-semibold text-[#0066B3]">
              Innovation Project Rubric
            </h2>
            <a
              href="https://firstinspires.blob.core.windows.net/fll/challenge/2025-26/fll-challenge-unearthed-rubrics-color.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#ED1C24] text-white rounded-lg font-medium hover:bg-[#C41E3A] transition text-sm"
            >
              View Official Rubric PDF
            </a>
          </div>

          <div className="space-y-5">
            {rubricData.map((section, idx) => (
              <div
                key={idx}
                className="border-2 border-[#0066B3] rounded-xl overflow-hidden"
              >
                <div className="bg-[#0066B3] text-white p-5">
                  <h3 className="text-lg font-semibold uppercase">
                    {section.category}
                  </h3>
                  <p className="text-sm opacity-95 mt-1">
                    {section.description}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 space-y-2">
                  {section.elements.map((element, elemIdx) => (
                    <div
                      key={elemIdx}
                      className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#0066B3] transition"
                    >
                      <span className="text-2xl text-[#0066B3]">☐</span>
                      <span className="flex-1 text-sm text-gray-700">
                        {element}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="bg-gray-800 text-white text-center py-5 mt-10">
        <p className="text-sm opacity-80">
          FIRST® LEGO® League is a registered trademark of FIRST®
        </p>
      </footer>
    </div>
  );
}
