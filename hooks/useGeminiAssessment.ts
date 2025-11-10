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
    // DISABLED: Causing crashes - just use audio only for now
    console.log('💬 📊 [DISABLED] Would send coach message:', message.substring(0, 60) + (message.length > 60 ? '...' : ''));
  }, []);

  const start = useCallback(async (audioStream: MediaStream) => {
    try {
      // Get ephemeral token from backend
      console.log('📊 Requesting Gemini ephemeral token...');
      const tokenResponse = await fetch('/api/gemini-token');
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        console.error('📊 Token request failed:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorData
        });
        throw new Error(`Failed to get ephemeral token: ${errorData.details || errorData.error || tokenResponse.statusText}`);
      }
      const tokenData = await tokenResponse.json();
      console.log('✅ Got ephemeral token response:', tokenData);
      const token = tokenData.token;
      console.log('✅ Using token:', token);

      // Connect to Gemini Live API with ephemeral token authentication
      // Note: Must use BidiGenerateContentConstrained (not BidiGenerateContent) with ephemeral tokens
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`;
      console.log('📊 Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);

      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ 📊 Gemini WebSocket connected');

        // SIMPLIFIED: Just send minimal setup - system instruction and tools only
        const setupMessage = {
          setup: {
            systemInstruction: {
              parts: [{ text: ASSESSMENT_PROMPT }]
            },
            tools: [{
              functionDeclarations: [{
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
        };

        console.log('📊 Sending simplified setup:', JSON.stringify(setupMessage, null, 2));
        ws.send(JSON.stringify(setupMessage));

        isConnectedRef.current = true;
      };

      ws.onmessage = (event) => {
        // Check if it's a Blob (binary data) or text
        if (event.data instanceof Blob) {
          console.log('📊 Received Blob data, size:', event.data.size);
          // Handle binary data if needed
          return;
        }

        const data = JSON.parse(event.data);

        // Check for errors first
        if (data.error) {
          console.error('❌ 📊 Gemini error:', data.error);
          return;
        }

        // Log raw message for debugging
        console.log('📊 Gemini raw message:', data);

        // Log different message types with appropriate detail
        if (data.setupComplete) {
          console.log('✅ 📊 Gemini setup complete');
        } else if (data.serverContent) {
          // Server is sending content (transcription, thinking, etc.)
          if (data.serverContent.modelTurn) {
            const parts = data.serverContent.modelTurn.parts || [];
            parts.forEach((part: any) => {
              if (part.text) {
                console.log('💭 📊 Gemini thinking/response:', part.text.substring(0, 100) + (part.text.length > 100 ? '...' : ''));
              }
              if (part.inlineData) {
                console.log('🎤 📊 Gemini processed audio data');
              }
            });
          }

          // Log transcription if available
          if (data.serverContent.turnComplete) {
            console.log('✅ 📊 Gemini completed processing turn');
          }
        } else if (data.toolCall) {
          // Handle function calls
          const functionCall = data.toolCall.functionCalls?.[0];
          if (functionCall?.name === 'updateRubricScore') {
            const args = functionCall.args;
            console.log('🔧 📊 Gemini tool call:', {
              area: args.area,
              score: args.score,
              explanation: args.explanation
            });

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
            console.log('✅ 📊 Sent tool response back to Gemini');
          }
        } else {
          // Log any other message types for debugging
          console.log('📊 Gemini message (other):', JSON.stringify(data, null, 2));
        }
      };

      ws.onerror = (error) => {
        console.error('❌ 📊 Gemini WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.error('❌ 📊 Gemini WebSocket closed:', {
          code: event.code,
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean,
          type: event.type
        });

        // Common close codes:
        // 1000 = Normal closure
        // 1006 = Abnormal closure (no close frame)
        // 1008 = Policy violation
        // 1011 = Server error
        if (event.code === 1008) {
          console.error('❌ Policy violation - likely authentication issue');
        } else if (event.code === 1006) {
          console.error('❌ Abnormal closure - connection dropped unexpectedly');
        }

        isConnectedRef.current = false;
      };

      // Start streaming audio to Gemini
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      let audioChunkCount = 0;
      let totalBytesSent = 0;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current && isConnectedRef.current) {
          audioChunkCount++;
          totalBytesSent += event.data.size;

          // Log every 5 seconds (5 chunks)
          if (audioChunkCount % 5 === 0) {
            console.log(`🎤 📊 Audio streaming: ${audioChunkCount} chunks, ${(totalBytesSent / 1024).toFixed(1)} KB sent`);
          }

          // Convert audio blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];

            // Send audio chunk to Gemini
            wsRef.current?.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{
                  data: base64Audio,
                  mimeType: 'audio/webm'
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

      console.log('✅ 📊 Started audio streaming to Gemini');

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
