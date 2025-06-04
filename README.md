# Twilio SIP Calling Interface

A simple web-based interface for making SIP calls using Twilio's Voice SDK. This application allows you to make outbound calls from a web browser to any SIP endpoint.

## Features

- Web-based calling interface
- Real-time call status updates
- Configurable SIP endpoints
- Built with Twilio Voice SDK
- Clean, responsive UI

## Prerequisites

- Node.js 14+ 
- A Twilio account with Voice capabilities
- A TwiML Application configured for voice
- Access to a SIP endpoint/provider

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd sip-test-twilio
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Twilio Account Configuration
TWILIO_ACCOUNT_ID=your_twilio_account_sid_here
TWILIO_API_KEY=your_twilio_api_key_here
TWILIO_API_SECRET=your_twilio_api_secret_here

# TwiML Application SID (for voice calling)
APP_SID=your_twiml_app_sid_here

# SIP endpoint to call (e.g., sip:user@domain.com)
SIP_URI=sip:your_username@your_sip_provider.com

# Optional Configuration
PORT=3000
WEBHOOK_PATH=voice-webhook
CALLER_IDENTITY=sipuser
```

### 3. Twilio Configuration

1. **Create a TwiML Application:**
   - Go to Twilio Console > Voice > TwiML > TwiML Apps
   - Create a new TwiML App
   - Set the Voice URL to: `http://your-domain/webhooks/voice-webhook`
   - Note the Application SID for your `.env` file

2. **Create API Keys:**
   - Go to Twilio Console > Settings > API Keys
   - Create a new API Key
   - Save the SID and Secret for your `.env` file

### 4. Run the Application

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Usage

1. Open the web interface in your browser
2. Click "Initialize Voice Client" to set up the connection
3. Once ready, click "Start Call" to initiate a call to your configured SIP endpoint
4. Use "End Call" to terminate the call

**Note:** This application only makes outbound calls. Device registration (which you may see mentioned in logs) is only required for receiving incoming calls, not for making outbound calls to SIP endpoints.

## Configuration Options

### Environment Variables

- `TWILIO_ACCOUNT_ID`: Your Twilio Account SID
- `TWILIO_API_KEY`: Your Twilio API Key SID  
- `TWILIO_API_SECRET`: Your Twilio API Key Secret
- `APP_SID`: Your TwiML Application SID
- `SIP_URI`: The SIP endpoint to call (format: `sip:user@domain.com`)
- `PORT`: Server port (default: 3000)
- `WEBHOOK_PATH`: Webhook endpoint path (default: voice-webhook)
- `CALLER_IDENTITY`: Caller identity for the session (default: sipuser)

### SIP URI Format

The SIP URI should follow the standard format:
- `sip:username@domain.com`
- `sip:12345@sip-provider.com:5060`

## Deployment

For production deployment:

1. Set up your server with HTTPS
2. Update your TwiML App Voice URL to use your production domain
3. Configure your environment variables on your hosting platform
4. Ensure your firewall allows the necessary ports for SIP traffic

## Troubleshooting

### Common Issues

1. **Registration Failed**: Check that your TwiML App Voice URL is correctly configured and accessible
2. **Token Generation Error**: Verify your Twilio credentials in the `.env` file
3. **SIP Connection Issues**: Ensure your SIP URI is correct and the endpoint is reachable

### Debug Logs

The application provides real-time logs in the web interface to help diagnose connection issues.

## Security Notes

- Never commit your `.env` file to version control
- Use HTTPS in production
- Regularly rotate your Twilio API keys
- Limit API key permissions to only what's needed

## License

MIT License - see LICENSE file for details 