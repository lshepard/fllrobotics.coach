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

interface RubricScores {
  problem: number;
  sources: number;
  plan: number;
  teamwork: number;
  innovation: number;
  prototype: number;
  sharing: number;
  iteration: number;
  communication: number;
  pride: number;
}

interface RubricExplanations {
  problem: string;
  sources: string;
  plan: string;
  teamwork: string;
  innovation: string;
  prototype: string;
  sharing: string;
  iteration: string;
  communication: string;
  pride: string;
}

// RubricRow Component
function RubricRow({ label, score, explanation }: { label: string; score: number; explanation: string }) {
  const getBarColor = (level: number) => {
    if (score >= level) {
      if (score === 4) return 'bg-yellow-400'; // Exceeds - gold
      if (score === 3) return 'bg-green-500'; // Accomplished - green
      if (score === 2) return 'bg-blue-400'; // Developing - blue
      return 'bg-gray-400'; // Beginning - gray
    }
    return 'bg-gray-200'; // Unfilled
  };

  const getLevelLabel = (level: number) => {
    if (level === 1) return 'Beginning';
    if (level === 2) return 'Developing';
    if (level === 3) return 'Accomplished';
    if (level === 4) return 'Exceeds';
    return '';
  };

  return (
    <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#0066B3]/30 transition-colors">
      {/* Label and Score */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-gray-800">{label}</span>
        <span className="text-sm font-medium text-gray-600">
          {score > 0 ? `${score}/4 - ${getLevelLabel(score)}` : 'Not assessed'}
        </span>
      </div>

      {/* Horizontal Bar Chart with 4 columns */}
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`flex-1 h-8 rounded transition-all ${getBarColor(level)} ${
              score >= level ? 'shadow-sm' : ''
            }`}
            title={getLevelLabel(level)}
          />
        ))}
      </div>

      {/* Level Labels */}
      <div className="flex gap-1 mb-3 text-xs text-gray-600">
        <div className="flex-1 text-center">1</div>
        <div className="flex-1 text-center">2</div>
        <div className="flex-1 text-center">3</div>
        <div className="flex-1 text-center">4</div>
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-700 italic">{explanation}</p>
        </div>
      )}
    </div>
  );
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

  // Rubric scores state
  const [rubricScores, setRubricScores] = useState<RubricScores>({
    problem: 0,
    sources: 0,
    plan: 0,
    teamwork: 0,
    innovation: 0,
    prototype: 0,
    sharing: 0,
    iteration: 0,
    communication: 0,
    pride: 0
  });

  const [rubricExplanations, setRubricExplanations] = useState<RubricExplanations>({
    problem: "",
    sources: "",
    plan: "",
    teamwork: "",
    innovation: "",
    prototype: "",
    sharing: "",
    iteration: "",
    communication: "",
    pride: ""
  });

  // Client tool function for updating rubric notes
  const updateRubricNotes = useCallback(({ area, notes }: { area: keyof RubricNotes, notes: string }) => {
    console.log(`[Client Tool] updateRubricNotes called:`, { area, notes });

    // Update state
    setRubricNotes(prev => ({
      ...prev,
      [area]: notes
    }));

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

  // Client tool function for updating rubric scores with explanation
  const updateRubricScoreWithExplanation = useCallback(({
    area,
    score,
    explanation
  }: {
    area: keyof RubricScores,
    score: number,
    explanation: string
  }) => {
    console.log(`[Client Tool] updateRubricScoreWithExplanation called:`, { area, score, explanation });

    // Validate score is between 0-4
    const validScore = Math.max(0, Math.min(4, score));

    // Update scores
    setRubricScores(prev => ({
      ...prev,
      [area]: validScore
    }));

    // Update explanations
    setRubricExplanations(prev => ({
      ...prev,
      [area]: explanation
    }));

    // Build context for agent
    const updatedScores: RubricScores = {
      ...rubricScores,
      [area]: validScore
    };

    const updatedExplanations: RubricExplanations = {
      ...rubricExplanations,
      [area]: explanation
    };

    // Format context
    const contextParts = [
      `Updated ${area} score to ${validScore}/4.`,
      `Reason: ${explanation}`,
      `\nCurrent rubric progress:`,
      `Problem: ${updatedScores.problem}/4 - ${updatedExplanations.problem || 'Not assessed'}`,
      `Sources: ${updatedScores.sources}/4 - ${updatedExplanations.sources || 'Not assessed'}`,
      `Plan: ${updatedScores.plan}/4 - ${updatedExplanations.plan || 'Not assessed'}`,
      `Teamwork: ${updatedScores.teamwork}/4 - ${updatedExplanations.teamwork || 'Not assessed'}`,
      `Innovation: ${updatedScores.innovation}/4 - ${updatedExplanations.innovation || 'Not assessed'}`,
      `Prototype: ${updatedScores.prototype}/4 - ${updatedExplanations.prototype || 'Not assessed'}`,
      `Sharing: ${updatedScores.sharing}/4 - ${updatedExplanations.sharing || 'Not assessed'}`,
      `Iteration: ${updatedScores.iteration}/4 - ${updatedExplanations.iteration || 'Not assessed'}`,
      `Communication: ${updatedScores.communication}/4 - ${updatedExplanations.communication || 'Not assessed'}`,
      `Pride: ${updatedScores.pride}/4 - ${updatedExplanations.pride || 'Not assessed'}`
    ].filter(Boolean);

    const context = contextParts.join('\n');
    console.log(`[Client Tool] Returning rubric score context:`, context);
    return context;
  }, [rubricScores, rubricExplanations]);

  const conversation = useConversation({
    agentId: AGENT_ID,
    clientTools: {
      updateRubricNotes: updateRubricNotes,
      updateRubricScoreWithExplanation: updateRubricScoreWithExplanation
    },
    onConnect: () => {
      console.log("Connected");
      console.log("🔧 Client tools registered:", Object.keys({ updateRubricNotes, updateRubricScoreWithExplanation }));
      console.log("🔧 updateRubricNotes function:", typeof updateRubricNotes);
      console.log("🔧 updateRubricScoreWithExplanation function:", typeof updateRubricScoreWithExplanation);
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
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio access");
      }

      // Enumerate devices to check if any audio input devices exist
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');

      console.log("Available audio input devices:", audioInputs);

      if (audioInputs.length === 0) {
        throw new Error("No microphone found. Please connect a microphone and try again.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setUserMediaStream(stream);
      // @ts-expect-error - Type incompatibility with @elevenlabs/react
      await conversation.startSession();
    } catch (error: unknown) {
      console.error("Failed to start conversation:", error);

      // Provide specific error messages based on error type
      let errorMessage = "Unknown error";

      if (error instanceof Error) {
        if (error.name === "NotFoundError") {
          errorMessage = "No microphone found. Please connect a microphone and refresh the page.";
        } else if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
        } else if (error.name === "NotReadableError") {
          errorMessage = "Microphone is already in use by another application.";
        } else if (error.name === "OverconstrainedError") {
          errorMessage = "No microphone meets the requirements.";
        } else {
          errorMessage = error.message;
        }
      }

      setError(`Failed to start: ${errorMessage}`);
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
          {/* LEFT: Rubric Progress Panel (wider, emphasized) */}
          <div className="flex-1 max-w-[900px]">
            <div className="bg-white rounded-2xl shadow-lg border border-[#0066B3]/20 p-8 sticky top-4">
              <h2 className="text-2xl font-bold text-[#0066B3] mb-6 flex items-center gap-2">
                <span>🏆</span>
                INNOVATION PROJECT RUBRIC
              </h2>

              {/* Rubric Groups */}
              <div className="space-y-8">
                {/* IDENTIFY Group */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wide">
                    IDENTIFY
                  </h3>
                  <div className="space-y-4">
                    {/* Problem */}
                    <RubricRow
                      label="Problem"
                      score={rubricScores.problem}
                      explanation={rubricExplanations.problem}
                    />
                    {/* Sources */}
                    <RubricRow
                      label="Sources"
                      score={rubricScores.sources}
                      explanation={rubricExplanations.sources}
                    />
                  </div>
                </div>

                {/* DESIGN Group */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wide">
                    DESIGN
                  </h3>
                  <div className="space-y-4">
                    {/* Plan */}
                    <RubricRow
                      label="Plan"
                      score={rubricScores.plan}
                      explanation={rubricExplanations.plan}
                    />
                    {/* Teamwork */}
                    <RubricRow
                      label="Teamwork"
                      score={rubricScores.teamwork}
                      explanation={rubricExplanations.teamwork}
                    />
                  </div>
                </div>

                {/* CREATE Group */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wide">
                    CREATE
                  </h3>
                  <div className="space-y-4">
                    {/* Innovation */}
                    <RubricRow
                      label="Innovation"
                      score={rubricScores.innovation}
                      explanation={rubricExplanations.innovation}
                    />
                    {/* Prototype */}
                    <RubricRow
                      label="Prototype"
                      score={rubricScores.prototype}
                      explanation={rubricExplanations.prototype}
                    />
                  </div>
                </div>

                {/* ITERATE Group */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wide">
                    ITERATE
                  </h3>
                  <div className="space-y-4">
                    {/* Sharing */}
                    <RubricRow
                      label="Sharing"
                      score={rubricScores.sharing}
                      explanation={rubricExplanations.sharing}
                    />
                    {/* Iteration */}
                    <RubricRow
                      label="Iteration"
                      score={rubricScores.iteration}
                      explanation={rubricExplanations.iteration}
                    />
                  </div>
                </div>

                {/* COMMUNICATE Group */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wide">
                    COMMUNICATE
                  </h3>
                  <div className="space-y-4">
                    {/* Communication */}
                    <RubricRow
                      label="Communication"
                      score={rubricScores.communication}
                      explanation={rubricExplanations.communication}
                    />
                    {/* Pride */}
                    <RubricRow
                      label="Pride"
                      score={rubricScores.pride}
                      explanation={rubricExplanations.pride}
                    />
                  </div>
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
