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

export function useOpenAIAssessment(
  onRubricUpdate: (update: RubricUpdate) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const sendCoachMessage = useCallback((message: string) => {
    console.log('💬 📊 [OpenAI] Coach message (not sent):', message.substring(0, 60) + '...');
  }, []);

  const start = useCallback(async (audioStream: MediaStream) => {
    try {
      console.log('📊 [OpenAI] Getting API key...');
      const response = await fetch('/api/openai-key');
      const { apiKey } = await response.json();

      console.log('📊 [OpenAI] Connecting to Realtime API...');

      // Connect to OpenAI Realtime API
      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
        ['realtime', `openai-insecure-api-key.${apiKey}`, 'openai-beta.realtime-v1']
      );

      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ 📊 [OpenAI] WebSocket connected');

        // Send session configuration
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text'], // No audio output
            instructions: ASSESSMENT_PROMPT,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            tools: [{
              type: 'function',
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
            }],
            tool_choice: 'auto'
          }
        }));

        isConnectedRef.current = true;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📊 [OpenAI] Message:', data.type);

        if (data.type === 'session.created' || data.type === 'session.updated') {
          console.log('✅ 📊 [OpenAI] Session ready');
        }

        // Handle function calls
        if (data.type === 'response.function_call_arguments.done') {
          const functionCall = data.call_id;
          const args = JSON.parse(data.arguments);
          
          console.log('🔧 📊 [OpenAI] Function call:', args);

          onRubricUpdate({
            area: args.area,
            score: args.score,
            explanation: args.explanation
          });

          // Send function result
          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: functionCall,
              output: JSON.stringify({ success: true })
            }
          }));

          console.log('✅ 📊 [OpenAI] Sent function response');
        }

        // Log transcriptions
        if (data.type === 'conversation.item.input_audio_transcription.completed') {
          console.log('🎤 📊 [OpenAI] Transcription:', data.transcript);
        }

        // Handle errors
        if (data.type === 'error') {
          console.error('❌ 📊 [OpenAI] Error:', data.error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ 📊 [OpenAI] WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('📊 [OpenAI] WebSocket closed:', event.code, event.reason);
        isConnectedRef.current = false;
      };

      // Set up audio processing - OpenAI expects PCM16 at 24kHz
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const sourceNode = audioContext.createMediaStreamSource(audioStream);
      sourceNodeRef.current = sourceNode;

      const bufferSize = 4096;
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        if (!isConnectedRef.current || !wsRef.current) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          const s = Math.max(-1, Math.min(1, pcmData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send as base64
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        
        wsRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64
        }));
      };

      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      console.log('✅ 📊 [OpenAI] Started audio streaming');

    } catch (error) {
      console.error('❌ 📊 [OpenAI] Failed to start:', error);
      throw error;
    }
  }, [onRubricUpdate]);

  const stop = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      isConnectedRef.current = false;
    }

    console.log('📊 [OpenAI] Stopped');
  }, []);

  return {
    start,
    stop,
    sendCoachMessage,
    isConnected: isConnectedRef.current
  };
}
