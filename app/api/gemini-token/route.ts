import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function GET() {
  console.log('📊 [Gemini Token] Endpoint called');

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('📊 [Gemini Token] ERROR: GEMINI_API_KEY not configured in environment variables');
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    );
  }

  console.log('📊 [Gemini Token] API key found:', apiKey.substring(0, 10) + '...');

  try {
    // Create client with API key
    const client = new GoogleGenAI({ apiKey });
    console.log('📊 [Gemini Token] Client created');

    // Calculate expiration times
    const expireTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const newSessionExpireTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes (time to start session)

    console.log('📊 [Gemini Token] Token config:', {
      expireTime: expireTime.toISOString(),
      newSessionExpireTime: newSessionExpireTime.toISOString()
    });

    // Create ephemeral token using SDK with LiveConnectConstraints
    const tokenData = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: expireTime.toISOString(),
        newSessionExpireTime: newSessionExpireTime.toISOString(),
        httpOptions: { apiVersion: 'v1alpha' },
        liveConnectConstraints: {
          model: 'models/gemini-2.5-flash-live-preview',
          config: {
            responseModalities: ['TEXT'],
          }
        }
      },
    });

    console.log('📊 [Gemini Token] Token created successfully. Full response:', JSON.stringify(tokenData, null, 2));

    return NextResponse.json({
      token: tokenData.name,
      expiresAt: tokenData.expireTime,
      fullData: tokenData, // Include full response for debugging
    });
  } catch (error: any) {
    console.error('📊 [Gemini Token] EXCEPTION:', {
      message: error?.message,
      status: error?.status,
      details: error?.details,
      stack: error?.stack,
      fullError: JSON.stringify(error, null, 2)
    });

    return NextResponse.json(
      {
        error: 'Failed to generate token',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
