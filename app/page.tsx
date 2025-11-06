"use client";

import { useState } from "react";
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
  const [messageInput, setMessageInput] = useState("");

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
      await navigator.mediaDevices.getUserMedia({ audio: true });
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
    } catch (error: unknown) {
      console.error("Failed to end conversation:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to end session: ${message}`);
    }
  };

  const toggleMute = () => {
    try {
      // @ts-expect-error - Type incompatibility with @elevenlabs/react
      conversation.setMuted(!conversation.isMuted);
    } catch (error: unknown) {
      console.error("Failed to toggle mute:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to toggle mute: ${message}`);
    }
  };

  const sendMessage = async () => {
    const message = messageInput.trim();
    if (message && conversation.status === "connected") {
      try {
        await conversation.sendUserMessage(message);
        setMessageInput("");
      } catch (error: unknown) {
        console.error("Failed to send message:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        setError(`Failed to send message: ${message}`);
      }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0066B3] text-white py-5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-semibold">
            FIRST LEGO League Innovation Project Coach
          </h1>
          <p className="text-sm opacity-90 mt-1">
            AI-Powered Coaching for Your Innovation Project
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Coach Section */}
        <div
          className="bg-white rounded-2xl p-8 mb-8 shadow-md relative overflow-hidden"
          style={{
            backgroundImage: "url(/project-team-presenting.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-white/85 rounded-2xl"></div>
          <div className="relative z-10">
            {/* BarVisualizer */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-64 h-48 flex items-center justify-center">
                <BarVisualizer
                  state={agentState}
                  barCount={15}
                  className="w-full h-32"
                />
              </div>
              <p className="text-sm font-medium text-gray-700 mt-2">
                {getStatusText()}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3 justify-center mb-6 flex-wrap">
              <button
                onClick={startConversation}
                disabled={isConnected}
                className="px-6 py-2 bg-[#0066B3] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#004A8F] transition"
              >
                Start Session
              </button>
              <button
                onClick={endConversation}
                disabled={!isConnected}
                className="px-6 py-2 bg-[#ED1C24] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#C41E3A] transition"
              >
                End Session
              </button>
              <button
                onClick={toggleMute}
                disabled={!isConnected}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition"
              >
                {/* @ts-expect-error - Type incompatibility with @elevenlabs/react */}
                {conversation.isMuted ? "🔇 Unmute" : "🎤 Mute"}
              </button>
            </div>

            {/* Text Input */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="Type a message to your coach..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && isConnected) {
                    sendMessage();
                  }
                }}
                disabled={!isConnected}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066B3] disabled:bg-gray-100"
              />
              <button
                onClick={sendMessage}
                disabled={!isConnected}
                className="px-6 py-2 bg-[#0066B3] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#004A8F] transition"
              >
                Send
              </button>
            </div>

            {/* Conversation Display */}
            <Conversation className="h-64 bg-gray-50 rounded-lg border border-gray-200">
              <ConversationContent>
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    Start a conversation with your coach...
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
        </div>

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
