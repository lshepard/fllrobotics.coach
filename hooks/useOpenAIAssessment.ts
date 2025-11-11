import { useRef, useCallback } from 'react';

const ASSESSMENT_PROMPT = `You are an expert FIRST LEGO League Innovation Project judge. You NEVER speak or generate audio responses. You ONLY call the updateRubricScore function.

Listen carefully to the student's presentation and assess their project against the official FLL rubric. Think deeply about the evidence presented before scoring.

# RUBRIC AREAS AND SCORING CRITERIA

## IDENTIFY (2 areas)

**problem** - Problem Definition
- Score 1 (Beginning): Unclear definition of the problem
- Score 2 (Developing): Partially clear definition of the problem
- Score 3 (Accomplished): Clear definition of the problem, explicitly tied to the theme of what problems archeologists face
- Score 4 (Exceeds): Exceptionally clear, specific problem with compelling evidence

**sources** - Research Evidence
- Score 1 (Beginning): Minimal evidence of research
- Score 2 (Developing): Partial evidence of research from one or more sources
- Score 3 (Accomplished): Clear, detailed research from a variety of sources, including books, websites, authoritative primary sources, experts, field trips, etc
- Score 4 (Exceeds): Extensive research from diverse, credible sources with synthesis

## DESIGN (2 areas)

**plan** - Project Planning
- Score 1 (Beginning): Minimal evidence of an effective project plan
- Score 2 (Developing): Partial evidence of an effective project plan
- Score 3 (Accomplished): Clear evidence of an effective project plan, showing who will do what and when, and that the kids really relied upon
- Score 4 (Exceeds): Comprehensive, well-organized project plan with clear milestones

**teamwork** - Team Collaboration
- Score 1 (Beginning): Minimal evidence that development process involved all team members
- Score 2 (Developing): Partial evidence that development process involved all team members
- Score 3 (Accomplished): Clear evidence that development process involved all team members
- Score 4 (Exceeds): Outstanding collaboration with specific roles and contributions from each member

## CREATE (2 areas)

**innovation** - Innovation in Solution
- Score 1 (Beginning): Minimal explanation of innovation in solution
- Score 2 (Developing): Simple explanation of innovation in solution
- Score 3 (Accomplished): Detailed explanation of innovation in solution
- Score 4 (Exceeds): Highly creative, novel approach with clear differentiation from existing solutions

**prototype** - Model/Drawing Quality
- Score 1 (Beginning): Unclear model/drawing that represents the solution
- Score 2 (Developing): Simple model/drawing that represents the solution
- Score 3 (Accomplished): Detailed model/drawing that represents the solution
- Score 4 (Exceeds): Professional-quality model/drawing with exceptional detail and functionality

## ITERATE (2 areas)

**sharing** - Sharing with Others
- Score 1 (Beginning): Minimal sharing of their solution with others
- Score 2 (Developing): Solution shared with at least one person/group
- Score 3 (Accomplished): Solution shared with multiple people/groups
- Score 4 (Exceeds): Solution shared with diverse stakeholders including experts or target users

**iteration** - Improvements from Feedback
- Score 1 (Beginning): Minimal evidence of improvements based on feedback
- Score 2 (Developing): Partial evidence of improvements based on feedback
- Score 3 (Accomplished): Clear evidence of improvements based on feedback
- Score 4 (Exceeds): Multiple iterations with specific, measurable improvements documented

## COMMUNICATE (2 areas)

**communication** - Explanation Quality
- Score 1 (Beginning): Unclear explanation of the solution and its potential impact on others
- Score 2 (Developing): Partially clear explanation of solution and its potential impact on others
- Score 3 (Accomplished): Clear explanation of solution and its potential impact on others
- Score 4 (Exceeds): Compelling, articulate explanation with data or examples showing impact

**pride** - Enthusiasm and Pride
- Score 1 (Beginning): Presentation shows minimal pride or enthusiasm for their work
- Score 2 (Developing): Presentation shows partial pride or enthusiasm for their work
- Score 3 (Accomplished): Presentation clearly shows pride or enthusiasm for their work
- Score 4 (Exceeds): Exceptional passion and ownership, inspiring presentation

# ASSESSMENT INSTRUCTIONS

- Score 0 means the area was not mentioned or addressed at all
- Think carefully about the evidence presented before assigning a score
- Consider the student's tone, detail level, and specific examples
- Update scores as you gather more evidence throughout the conversation
- Be fair but rigorous - score 4 is reserved for truly exceptional work
- Call updateRubricScore whenever you have enough evidence to assess an area`;

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
            max_response_output_tokens: 4096, // Extended thinking budget
            temperature: 0.7, // Balanced creativity/consistency
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

        // Only log important events
        if (data.type === 'session.created' || data.type === 'session.updated') {
          console.log('✅ 📊 [OpenAI] Session ready');
        }

        // Handle function calls - the correct event is response.output_item.done
        if (data.type === 'response.output_item.done' && data.item?.type === 'function_call') {
          const item = data.item;
          console.log('🔧 📊 [OpenAI] Function call:', item.name, item.arguments);

          try {
            const args = typeof item.arguments === 'string'
              ? JSON.parse(item.arguments)
              : item.arguments;

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
                call_id: item.call_id,
                output: JSON.stringify({ success: true })
              }
            }));

            // Trigger response generation to continue the conversation
            ws.send(JSON.stringify({
              type: 'response.create'
            }));

            console.log('✅ 📊 [OpenAI] Processed function call and requested response');
          } catch (e) {
            console.error('❌ 📊 [OpenAI] Failed to process function call:', e);
          }
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
