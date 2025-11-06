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
    if (!isConnected) return;

    let captureAttempted = false;

    const captureAudioStream = async (audio: HTMLAudioElement) => {
      if (audio === audioElementRef.current || captureAttempted) return;
      if (!audio.src && !audio.srcObject) return;

      try {
        captureAttempted = true;

        // If audio element has a MediaStream srcObject, use it directly
        if (audio.srcObject && audio.srcObject instanceof MediaStream) {
          agentMediaStreamRef.current = audio.srcObject;
          audioElementRef.current = audio;
          forceUpdate({});
          return;
        }

        // Fallback: route through Web Audio API
        if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        const destination = audioContextRef.current.createMediaStreamDestination();
        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(destination);
        source.connect(audioContextRef.current.destination);

        agentMediaStreamRef.current = destination.stream;
        audioElementRef.current = audio;
        forceUpdate({});
      } catch (err) {
        console.error('Failed to capture audio:', err);
      }
    };

    const handlePlay = (event: Event) => {
      captureAudioStream(event.target as HTMLAudioElement);
    };

    const setupListeners = () => {
      document.querySelectorAll('audio').forEach(audio => {
        if (!audio.paused && audio.currentTime > 0) {
          captureAudioStream(audio);
        }
        audio.addEventListener('play', handlePlay);
      });
    };

    setupListeners();

    const observer = new MutationObserver(() => {
      if (!captureAttempted) setupListeners();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll('audio').forEach(audio => {
        audio.removeEventListener('play', handlePlay);
      });
    };
  }, [isConnected]);

  // Use user's microphone stream when listening, agent's audio when speaking
  const visualizerStream = conversation.status === "connected"
    ? (conversation.isSpeaking ? agentMediaStreamRef.current : userMediaStream)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Image */}
      <div
        className="w-full shadow-md"
        style={{
          backgroundImage: "url(/project-team-presenting.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          height: "35vh",
          minHeight: "250px",
        }}
      />

      {/* Title Header Section */}
      <div className="bg-gradient-to-br from-[#0066B3] to-[#004a8a] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              FIRST LEGO League Innovation Project Coach
            </h1>
            <p className="text-lg md:text-xl text-white/95">
              AI-Powered Coaching for Your Innovation Project
            </p>
          </div>

          {error && (
            <div className="max-w-2xl mx-auto mt-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Bar Visualizer */}
        <div className="max-w-4xl mx-auto mb-12">
          <div
            className="cursor-pointer"
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
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#0066B3]/20">
              <BarVisualizer
                state={agentState}
                barCount={20}
                mediaStream={visualizerStream}
                minHeight={10}
                maxHeight={95}
                className="w-full h-32 bg-gray-50 rounded-lg"
                key={visualizerStream?.id || 'no-stream'}
              />
              <div className="mt-4 text-center">
                <p className="text-xl font-semibold text-gray-800">
                  {getStatusText()}
                </p>
                {!isConnected && (
                  <p className="text-sm text-gray-500 mt-1">
                    Click to start your coaching session
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
          <div className="max-w-4xl mx-auto mb-12">
            <Conversation className="h-[500px] bg-white rounded-2xl shadow-lg border border-[#0066B3]/20">
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

        {/* Rubric Link */}
        <div className="text-center mt-12">
          <a
            href="https://firstinspires.blob.core.windows.net/fll/challenge/2025-26/fll-challenge-unearthed-rubrics-color.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0066B3] text-white rounded-lg font-medium hover:bg-[#0066B3]/90 transition shadow-md"
          >
            <span>📋</span>
            View Innovation Project Rubric
          </a>
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
