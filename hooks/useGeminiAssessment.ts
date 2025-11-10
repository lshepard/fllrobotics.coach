import { useRef, useCallback } from 'react';

const ASSESSMENT_PROMPT = `You are a SILENT observer assessing a FIRST LEGO League Innovation Project.

CRITICAL: You NEVER speak or generate audio responses. You ONLY call the updateRubricScore function.

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
            model: 'models/gemini-2.0-flash-exp',
            generation_config: {
              response_modalities: ['TEXT'], // NO AUDIO output
              speech_config: {
                voice_config: { prebuilt_voice_config: { voice_name: 'Puck' } }
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

      // Start streaming audio
      // TODO: Implement audio capture and streaming in next step

    } catch (error) {
      console.error('Failed to start Gemini assessment:', error);
      throw error;
    }
  }, [onRubricUpdate]);

  const stop = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      isConnectedRef.current = false;
      console.log('📊 Stopped Gemini assessment');
    }
  }, []);

  return { start, stop, isConnected: isConnectedRef.current };
}
