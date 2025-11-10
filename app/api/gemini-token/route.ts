import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    // Request ephemeral token from Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/cachedContents:generateEphemeralToken?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Token expires in 1 minute for starting new sessions
          newSessionExpireTime: '60s',
          // Session can last up to 30 minutes
          expireTime: '1800s',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to generate ephemeral token:', error);
      return NextResponse.json(
        { error: 'Failed to generate token' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      token: data.token,
      expiresAt: data.expireTime,
    });
  } catch (error) {
    console.error('Error generating ephemeral token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
