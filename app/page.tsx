"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import {
  Conversation,
  ConversationContent,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";

const CONVERSATIONAL_AGENT_ID = "agent_01jvcwy4xseqg8qjgw6wbgsywd";

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

// RubricRow Component - simplified, no text labels
function RubricRow({ label, score }: { label: string; score: number }) {
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
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-700 w-20 flex-shrink-0">{label}</span>
      <div className="flex gap-0.5 flex-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`flex-1 h-3 rounded-sm transition-all ${getBarColor(level)}`}
            title={getLevelLabel(level)}
          />
        ))}
      </div>
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

  // Audio recording for Gemini assessment
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isAssessing, setIsAssessing] = useState(false);

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

  // Store reference to conversational agent for context updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversationalAgentRef = useRef<any>(null);

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

    // Build updated state for analysis
    const updatedScores: RubricScores = {
      ...rubricScores,
      [area]: validScore
    };

    // Calculate what still needs attention
    const unassessed = Object.entries(updatedScores)
      .filter(([, v]) => v === 0)
      .map(([k]) => k);
    const weak = Object.entries(updatedScores)
      .filter(([, v]) => v > 0 && v < 2)
      .map(([k]) => k);

    // Send contextual update to conversational agent (feedback loop)
    if (conversationalAgentRef.current) {
      const contextMessage = `
[Rubric Update - Internal Context]
Area: ${area}
Score: ${validScore}/4
Reasoning: ${explanation}

Areas not yet discussed: ${unassessed.join(', ') || 'none'}
Areas needing more detail (score 1): ${weak.join(', ') || 'none'}

Guide the conversation naturally toward unexplored or weak areas with follow-up questions.
      `.trim();

      try {
        conversationalAgentRef.current.sendContextualUpdate?.(contextMessage);
        console.log(`📨 Sent context to conversational agent:`, contextMessage);
      } catch (error) {
        console.error('Failed to send contextual update:', error);
      }
    }

    return `Assessed ${area}: ${validScore}/4`;
  }, [rubricScores]);

  // Conversational Agent - handles dialogue with students
  const conversation = useConversation({
    agentId: CONVERSATIONAL_AGENT_ID,
    clientTools: {
      // Keep rubricNotes tool if you want memory, or remove it
      // updateRubricNotes: updateRubricNotes,
    },
    onConnect: () => {
      console.log("🗣️ Conversational agent connected");
    },
    onDisconnect: () => {
      console.log("🗣️ Conversational agent disconnected");
    },
    onMessage: (message) => {
      console.log("🗣️ Message received:", message);
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
      console.error("🗣️ Conversational agent error:", error);
      setError(typeof error === 'string' ? error : "An error occurred");
      setTimeout(() => setError(null), 5000);
    },
  });

  // TODO: Add Gemini streaming assessment here

  // Store reference for context updates
  useEffect(() => {
    conversationalAgentRef.current = conversation;
  }, [conversation]);

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

      // Start conversational agent
      console.log("🚀 Starting conversational agent...");

      // @ts-expect-error - startSession types are inconsistent
      await conversation.startSession();

      // TODO: Start Gemini streaming assessment

      console.log("✅ Conversational agent started!");
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
      console.log("🛑 Ending conversation...");

      await conversation.endSession();

      // TODO: Stop Gemini streaming

      console.log("✅ Conversation ended");

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

      {/* Main Content Area - Responsive Layout */}
      <div className="max-w-[1800px] mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Voice Visualizer - first on mobile, right on desktop */}
          <div className="w-full lg:w-[400px] lg:order-3 flex-shrink-0">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-[#0066B3]/20 sticky top-4">
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
                      {messages.length > 0 ? 'Pause' : 'End Session'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* LEFT on desktop, second on mobile: Rubric Progress Panel (narrower) */}
          <div className="w-full lg:w-[400px] lg:order-1 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-lg border border-[#0066B3]/20 p-4 sticky top-4">
              <h2 className="text-lg font-bold text-[#0066B3] mb-3 flex items-center gap-2">
                <span>🏆</span>
                RUBRIC
              </h2>

              {/* Rubric Groups */}
              <div className="space-y-3">
                {/* IDENTIFY Group */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
                    IDENTIFY
                  </h3>
                  <div className="space-y-1.5">
                    {/* Problem */}
                    <RubricRow
                      label="Problem"
                      score={rubricScores.problem}
                    />
                    {/* Sources */}
                    <RubricRow
                      label="Sources"
                      score={rubricScores.sources}
                    />
                  </div>
                </div>

                {/* DESIGN Group */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
                    DESIGN
                  </h3>
                  <div className="space-y-1.5">
                    {/* Plan */}
                    <RubricRow
                      label="Plan"
                      score={rubricScores.plan}
                    />
                    {/* Teamwork */}
                    <RubricRow
                      label="Teamwork"
                      score={rubricScores.teamwork}
                    />
                  </div>
                </div>

                {/* CREATE Group */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
                    CREATE
                  </h3>
                  <div className="space-y-1.5">
                    {/* Innovation */}
                    <RubricRow
                      label="Innovation"
                      score={rubricScores.innovation}
                    />
                    {/* Prototype */}
                    <RubricRow
                      label="Prototype"
                      score={rubricScores.prototype}
                    />
                  </div>
                </div>

                {/* ITERATE Group */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
                    ITERATE
                  </h3>
                  <div className="space-y-1.5">
                    {/* Sharing */}
                    <RubricRow
                      label="Sharing"
                      score={rubricScores.sharing}
                    />
                    {/* Iteration */}
                    <RubricRow
                      label="Iteration"
                      score={rubricScores.iteration}
                    />
                  </div>
                </div>

                {/* COMMUNICATE Group */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
                    COMMUNICATE
                  </h3>
                  <div className="space-y-1.5">
                    {/* Communication */}
                    <RubricRow
                      label="Communication"
                      score={rubricScores.communication}
                    />
                    {/* Pride */}
                    <RubricRow
                      label="Pride"
                      score={rubricScores.pride}
                    />
                  </div>
                </div>
              </div>

              {/* Rubric Link */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <a
                  href="https://firstinspires.blob.core.windows.net/fll/challenge/2025-26/fll-challenge-unearthed-rubrics-color.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#0066B3] text-white rounded text-[10px] font-medium hover:bg-[#0066B3]/90 transition"
                >
                  <span>📄</span>
                  Official Rubric
                </a>
              </div>
            </div>
          </div>

          {/* MIDDLE on desktop, third on mobile: Commentary Panel (wider) */}
          <div className="flex-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-lg border border-[#0066B3]/20 p-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <h2 className="text-lg font-bold text-[#0066B3] mb-3">
                AI Coach Feedback
              </h2>

              <div className="space-y-3">
                {/* Show explanations for each rubric area */}
                {Object.entries(rubricExplanations).map(([key, explanation]) => {
                  const score = rubricScores[key as keyof RubricScores];
                  if (!explanation) return null;

                  return (
                    <div key={key} className="border-l-4 border-[#0066B3] pl-3 py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-800 capitalize">{key}</span>
                        <span className="text-xs text-gray-500">({score}/4)</span>
                      </div>
                      <p className="text-sm text-gray-700">{explanation}</p>
                    </div>
                  );
                })}

                {/* Empty state */}
                {Object.values(rubricExplanations).every(exp => !exp) && (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="text-sm">AI coach feedback will appear here as you discuss your project</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Conversation Display at the bottom - show if connected OR if there are messages */}
        {(isConnected || messages.length > 0) && (
          <div className="mt-6">
            <Conversation className="h-[400px] bg-white rounded-2xl shadow-lg border border-[#0066B3]/20">
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

      <footer className="bg-gray-800 text-white text-center py-5 mt-10">
        <p className="text-sm opacity-80">
          FIRST® LEGO® League is a registered trademark of FIRST®
        </p>
      </footer>
    </div>
  );
}
