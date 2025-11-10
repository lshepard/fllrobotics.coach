import { useRef, useCallback } from 'react';

const ASSESSMENT_PROMPT = `You are a SILENT observer assessing a FIRST LEGO League Innovation Project.

CRITICAL: You NEVER speak or generate audio responses. You ONLY call the updateRubricScore function.

You will receive:
- AUDIO STREAM: Student speaking (assess content, tone, enthusiasm, clarity)
- TEXT with role='model': Coach's questions/responses (context only - DO NOT ASSESS)

Assess ONLY the student's audio responses. Use the coach's questions to understand context.

Listen to the conversation and assess the project against these 10 rubric areas:
1. problem - Clear problem identification
2. sources - Research sources (interviews, experts, etc.)
3. plan - Project planning and organization
4. teamwork - Team collaboration evidence
5. innovation - What makes solution unique/innovative
6. prototype - Model/prototype quality
7. sharing - Who they shared solution with
8. iteration - Changes based on feedback
9. communication - How clearly they explain (assess throughout)
10. pride - Enthusiasm and ownership (assess throughout)

Scoring (0-4):
- 0: Not mentioned
- 1: Beginning - minimal evidence
- 2: Developing - good progress, needs refinement
- 3: Accomplished - meets criteria excellently ⭐
- 4: Exceeds - significantly beyond expectations ✨ (RARE)

Call updateRubricScore immediately when you hear evidence for any area. Update scores as you learn more.`;

interface RubricUpdate {
  area: string;
  score: number;
  explanation: string;
}

export function useGeminiAssessment(
  onRubricUpdate: (update: RubricUpdate) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Send coach's text response to Gemini for context
  const sendCoachMessage = useCallback((message: string) => {
    if (wsRef.current && isConnectedRef.current) {
      wsRef.current.send(JSON.stringify({
        client_content: {
          turns: [{
            role: 'model', // Marks as coach, not student
            parts: [{ text: message }]
          }],
          turn_complete: true
        }
      }));
      console.log('📊 Sent coach message to Gemini for context');
    }
  }, []);

  const start = useCallback(async (audioStream: MediaStream) => {
    try {
      // Get ephemeral token from backend
      console.log('📊 Requesting Gemini ephemeral token...');
      const tokenResponse = await fetch('/api/gemini-token');
      if (!tokenResponse.ok) {
        throw new Error('Failed to get ephemeral token');
      }
      const { token } = await tokenResponse.json();
      console.log('✅ Got ephemeral token');

      // Connect to Gemini Live API
      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`
      );

      wsRef.current = ws;

      ws.onopen = () => {
        console.log('📊 Gemini WebSocket connected');

        // Send setup message
        ws.send(JSON.stringify({
          setup: {
            model: 'models/gemini-2.5-flash-live-preview',
            generation_config: {
              response_modalities: ['TEXT'], // NO AUDIO output
              thinking_config: {
                thinking_budget: 8192 // Higher budget for better assessment quality (0-24576)
                // Use -1 for dynamic thinking (model decides based on complexity)
                // Use 0 to disable thinking (faster but less accurate)
              }
            },
            system_instruction: {
              parts: [{ text: ASSESSMENT_PROMPT }]
            },
            tools: [{
              function_declarations: [{
                name: 'updateRubricScore',
                description: 'Update the rubric score for a specific area',
                parameters: {
                  type: 'object',
                  properties: {
                    area: {
                      type: 'string',
                      enum: ['problem', 'sources', 'plan', 'teamwork', 'innovation', 'prototype', 'sharing', 'iteration', 'communication', 'pride'],
                      description: 'The rubric area to update'
                    },
                    score: {
                      type: 'number',
                      minimum: 0,
                      maximum: 4,
                      description: 'Score from 0-4'
                    },
                    explanation: {
                      type: 'string',
                      description: 'Why you gave this score (1-2 sentences)'
                    }
                  },
                  required: ['area', 'score', 'explanation']
                }
              }]
            }]
          }
        }));

        isConnectedRef.current = true;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📊 Gemini message:', data);

        // Handle function calls
        if (data.toolCall) {
          const functionCall = data.toolCall.functionCalls?.[0];
          if (functionCall?.name === 'updateRubricScore') {
            const args = functionCall.args;
            onRubricUpdate({
              area: args.area,
              score: args.score,
              explanation: args.explanation
            });

            // Send function response back
            ws.send(JSON.stringify({
              tool_response: {
                function_responses: [{
                  id: functionCall.id,
                  name: 'updateRubricScore',
                  response: { success: true }
                }]
              }
            }));
          }
        }
      };

      ws.onerror = (error) => {
        console.error('📊 Gemini WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('📊 Gemini WebSocket closed');
        isConnectedRef.current = false;
      };

      // Start streaming audio to Gemini
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current && isConnectedRef.current) {
          // Convert audio blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];

            // Send audio chunk to Gemini
            wsRef.current?.send(JSON.stringify({
              realtime_input: {
                media_chunks: [{
                  data: base64Audio,
                  mime_type: 'audio/webm'
                }]
              }
            }));
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Capture audio in 1-second chunks for streaming
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;

      console.log('📊 Started audio streaming to Gemini');

    } catch (error) {
      console.error('Failed to start Gemini assessment:', error);
      throw error;
    }
  }, [onRubricUpdate]);

  const stop = useCallback(() => {
    // Stop audio recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      isConnectedRef.current = false;
    }

    console.log('📊 Stopped Gemini assessment');
  }, []);

  return {
    start,
    stop,
    sendCoachMessage,
    isConnected: isConnectedRef.current
  };
}
