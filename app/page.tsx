"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

interface RubricNotes {
  teamInfo: string;
  problem: string;
  sources: string;
  solution: string;
  sharedWith: string;
  iterations: string;
}

export default function Home() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userMediaStream, setUserMediaStream] = useState<MediaStream | null>(null);
  const agentMediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [, forceUpdate] = useState({});

  // Rubric notes state
  const [rubricNotes, setRubricNotes] = useState<RubricNotes>({
    teamInfo: "",
    problem: "",
    sources: "",
    solution: "",
    sharedWith: "",
    iterations: ""
  });
  const [recentlyUpdated, setRecentlyUpdated] = useState<keyof RubricNotes | null>(null);

  // Client tool function for updating rubric notes
  const updateRubricNotes = useCallback(({ area, notes }: { area: keyof RubricNotes, notes: string }) => {
    console.log(`[Client Tool] updateRubricNotes called:`, { area, notes });

    // Update state
    setRubricNotes(prev => ({
      ...prev,
      [area]: notes
    }));

    // Trigger animation
    setRecentlyUpdated(area);
    setTimeout(() => setRecentlyUpdated(null), 2000);

    // Build updated notes object for context
    const updated: RubricNotes = {
      ...rubricNotes,
      [area]: notes
    };

    // Format context for agent
    const contextParts = [
      `Updated ${area}. Current project memory:`,
      updated.teamInfo && `Team: ${updated.teamInfo}`,
      updated.problem && `Problem: ${updated.problem}`,
      updated.sources && `Sources: ${updated.sources}`,
      updated.solution && `Solution: ${updated.solution}`,
      updated.sharedWith && `Shared With: ${updated.sharedWith}`,
      updated.iterations && `Iterations: ${updated.iterations}`
    ].filter(Boolean);

    const context = contextParts.join('\n');
    console.log(`[Client Tool] Returning context:`, context);
    return context;
  }, [rubricNotes]);

  const conversation = useConversation({
    agentId: AGENT_ID,
    clientTools: {
      updateRubricNotes: updateRubricNotes
    },
    onConnect: () => {
      console.log("Connected");
      console.log("🔧 Client tools registered:", Object.keys({ updateRubricNotes }));
      console.log("🔧 updateRubricNotes function:", typeof updateRubricNotes);
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
    onUnhandledClientToolCall: (toolCall) => {
      console.error('❌ UNHANDLED CLIENT TOOL CALL:', toolCall);
      console.error('Tool name:', toolCall);
    },
    onAgentToolResponse: (response) => {
      console.log('✅ Agent tool response received:', response);
    },
    onDebug: (debugInfo) => {
      console.log('🐛 Debug info:', debugInfo);
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

      {/* Main Content Area - Side by Side Layout */}
      <div className="max-w-[1800px] mx-auto px-4 py-12">
        <div className="flex gap-6">
          {/* LEFT: Project Notes Panel (wider, emphasized) */}
          <div className="flex-1 max-w-[900px]">
            <div className="bg-white rounded-2xl shadow-lg border border-[#0066B3]/20 p-8 sticky top-4">
              <h2 className="text-2xl font-bold text-[#0066B3] mb-6 flex items-center gap-2">
                <span>📋</span>
                PROJECT NOTES
              </h2>

              {/* Empty State */}
              {!rubricNotes.teamInfo && !rubricNotes.problem && !rubricNotes.sources &&
               !rubricNotes.solution && !rubricNotes.sharedWith && !rubricNotes.iterations && (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">🎤</div>
                  <p className="text-lg font-medium mb-2">Start talking with your coach!</p>
                  <p className="text-sm">As you discuss your project, the coach will remember key details here:</p>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <p>• Team details (name, members)</p>
                    <p>• Problem you identified</p>
                    <p>• Research sources</p>
                    <p>• Your solution</p>
                    <p>• Who you shared with</p>
                    <p>• Improvements you made</p>
                  </div>
                </div>
              )}

              {/* Notes Sections */}
              <div className="space-y-6">
                {/* Team Info Section */}
                <div className={`border-2 rounded-xl p-4 transition-all ${
                  recentlyUpdated === 'teamInfo'
                    ? 'border-[#0066B3] bg-[#0066B3]/5 shadow-md'
                    : 'border-gray-200'
                }`}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <span>👥</span> Team Info
                  </h3>
                  {rubricNotes.teamInfo ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{rubricNotes.teamInfo}</p>
                  ) : (
                    <p className="text-gray-400 italic text-sm">Not yet discussed</p>
                  )}
                </div>

                {/* Problem Section */}
                <div className={`border-2 rounded-xl p-4 transition-all ${
                  recentlyUpdated === 'problem'
                    ? 'border-[#0066B3] bg-[#0066B3]/5 shadow-md'
                    : 'border-gray-200'
                }`}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <span>🎯</span> Problem
                  </h3>
                  {rubricNotes.problem ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{rubricNotes.problem}</p>
                  ) : (
                    <p className="text-gray-400 italic text-sm">Not yet discussed</p>
                  )}
                </div>

                {/* Sources Section */}
                <div className={`border-2 rounded-xl p-4 transition-all ${
                  recentlyUpdated === 'sources'
                    ? 'border-[#0066B3] bg-[#0066B3]/5 shadow-md'
                    : 'border-gray-200'
                }`}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <span>📚</span> Sources
                  </h3>
                  {rubricNotes.sources ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{rubricNotes.sources}</p>
                  ) : (
                    <p className="text-gray-400 italic text-sm">Not yet discussed</p>
                  )}
                </div>

                {/* Solution Section */}
                <div className={`border-2 rounded-xl p-4 transition-all ${
                  recentlyUpdated === 'solution'
                    ? 'border-[#0066B3] bg-[#0066B3]/5 shadow-md'
                    : 'border-gray-200'
                }`}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <span>💡</span> Solution
                  </h3>
                  {rubricNotes.solution ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{rubricNotes.solution}</p>
                  ) : (
                    <p className="text-gray-400 italic text-sm">Not yet discussed</p>
                  )}
                </div>

                {/* Shared With Section */}
                <div className={`border-2 rounded-xl p-4 transition-all ${
                  recentlyUpdated === 'sharedWith'
                    ? 'border-[#0066B3] bg-[#0066B3]/5 shadow-md'
                    : 'border-gray-200'
                }`}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <span>🤝</span> Shared With
                  </h3>
                  {rubricNotes.sharedWith ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{rubricNotes.sharedWith}</p>
                  ) : (
                    <p className="text-gray-400 italic text-sm">Not yet discussed</p>
                  )}
                </div>

                {/* Iterations Section */}
                <div className={`border-2 rounded-xl p-4 transition-all ${
                  recentlyUpdated === 'iterations'
                    ? 'border-[#0066B3] bg-[#0066B3]/5 shadow-md'
                    : 'border-gray-200'
                }`}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <span>🔄</span> Iterations
                  </h3>
                  {rubricNotes.iterations ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{rubricNotes.iterations}</p>
                  ) : (
                    <p className="text-gray-400 italic text-sm">Not yet discussed</p>
                  )}
                </div>
              </div>

              {/* Rubric Link */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <a
                  href="https://firstinspires.blob.core.windows.net/fll/challenge/2025-26/fll-challenge-unearthed-rubrics-color.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#0066B3] text-white rounded-lg font-medium hover:bg-[#0066B3]/90 transition text-sm"
                >
                  <span>📄</span>
                  View Official Rubric
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT: Conversation Panel (narrower, minimized) */}
          <div className="w-[400px] flex-shrink-0">
            <div className="space-y-6 sticky top-4">
              {/* Bar Visualizer */}
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
                <div className="bg-white rounded-2xl p-4 shadow-lg border border-[#0066B3]/20">
                  <BarVisualizer
                    state={agentState}
                    barCount={15}
                    mediaStream={visualizerStream}
                    minHeight={10}
                    maxHeight={80}
                    className="w-full h-24 bg-gray-50 rounded-lg"
                    key={visualizerStream?.id || 'no-stream'}
                  />
                  <div className="mt-3 text-center">
                    <p className="text-sm font-semibold text-gray-800">
                      {getStatusText()}
                    </p>
                    {!isConnected && (
                      <p className="text-xs text-gray-500 mt-1">
                        Click to start
                      </p>
                    )}
                    {isConnected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          endConversation();
                        }}
                        className="mt-2 px-4 py-1 bg-[#ED1C24] text-white rounded-lg text-sm font-medium hover:bg-[#C41E3A] transition"
                      >
                        End Session
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Conversation Display */}
              {isConnected && (
                <div>
                  <Conversation className="h-[600px] bg-white rounded-2xl shadow-lg border border-[#0066B3]/20">
                    <ConversationContent>
                      {messages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8 text-sm">
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
