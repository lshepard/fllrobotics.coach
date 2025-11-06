# FLL Robotics Coach - Voice Agent

A React-based voice agent application using ElevenLabs AI for conversational interactions.

## Features

- Real-time voice conversations with AI agent
- Microphone control (mute/unmute)
- Volume control for agent responses
- Text message input alongside voice
- Live conversation transcripts
- Visual status indicators

## Tech Stack

- React 18
- Vite (build tool)
- ElevenLabs Client SDK
- Hosted on Railway

## Local Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open your browser to the URL shown in the terminal (typically http://localhost:5173)

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm start` - Start production server (used by Railway)

## Deployment to Railway

### Option 1: Deploy from GitHub

1. Push your code to a GitHub repository
2. Go to [Railway](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will automatically detect the Node.js project and deploy it

### Option 2: Deploy using Railway CLI

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Initialize and deploy:
```bash
railway init
railway up
```

### Railway Configuration

Railway will automatically:
- Install dependencies using `npm install`
- Build the project using `npm run build`
- Start the server using `npm start`

The app is configured to use the `$PORT` environment variable provided by Railway.

### Custom Domain

After deployment, you can add a custom domain in Railway:
1. Go to your project settings
2. Click "Settings" → "Domains"
3. Add your custom domain

## Project Structure

```
/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # Vite HTML entry point
├── vite.config.js       # Vite configuration
├── package.json         # Project dependencies and scripts
└── README.md           # This file
```

## Environment Variables

No environment variables are required for basic functionality. The agent ID is hardcoded in `src/App.jsx`.

To use a different agent, modify the `AGENT_ID` constant in `src/App.jsx`:

```javascript
const AGENT_ID = "your_agent_id_here"
```

## Browser Compatibility

This application requires:
- Modern browser with WebRTC support
- Microphone access permissions
- HTTPS connection (for microphone access)

## License

MIT
