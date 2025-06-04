// server.js
import 'dotenv/config';
import express from 'express';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// Basic request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
  next();
});

// Serve Twilio SDK from node_modules
app.use('/twilio-sdk', express.static(path.join(__dirname, 'node_modules/@twilio/voice-sdk')));

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const {
  TWILIO_ACCOUNT_ID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  APP_SID,
  SIP_URI,
  WEBHOOK_PATH = 'twilio/cmb5v3a6b0001pofthcngifxq/initiate', // Use original path as default
  CALLER_IDENTITY = 'sipuser' // Configurable caller identity
} = process.env;

// Validate environment variables
if (!TWILIO_ACCOUNT_ID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !APP_SID || !SIP_URI) {
  console.error('Missing required environment variables. Please check your .env file.');
  console.error('Required: TWILIO_ACCOUNT_ID, TWILIO_API_KEY, TWILIO_API_SECRET, APP_SID, SIP_URI');
  process.exit(1);
}

console.log('SIP calling service started');
console.log(`Webhook endpoint: /webhooks/${WEBHOOK_PATH}`);

// Frontend interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>SIP Calling Interface</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
        button { padding: 15px 30px; font-size: 16px; margin: 10px; border: none; border-radius: 5px; cursor: pointer; }
        #call { background: #28a745; color: white; }
        #hangup { background: #dc3545; color: white; }
        #initialize { background: #007bff; color: white; }
        #status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .ready { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
        .warning { background: #fff3cd; color: #856404; }
        #logs { background: #f8f9fa; padding: 10px; margin: 10px 0; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; }
    </style>
</head>
<body>
    <h1>SIP Calling Interface</h1>
    <p>Target: ${SIP_URI}</p>
    
    <div id="status" class="info">Ready to initialize</div>
    <div id="logs"></div>
    
    <button id="initialize">Initialize Voice Client</button>
    <button id="call" disabled>Start Call</button>
    <button id="hangup" disabled>End Call</button>

    <script type="module">
        // Load Twilio SDK
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/twilio-sdk/dist/twilio.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        const { Device } = Twilio;
        
        let device = null;
        let connection = null;
        
        const status = document.getElementById('status');
        const logs = document.getElementById('logs');
        const callBtn = document.getElementById('call');
        const hangupBtn = document.getElementById('hangup');
        const initBtn = document.getElementById('initialize');
        
        function updateStatus(msg, type = 'info') {
            status.textContent = msg;
            status.className = type;
        }
        
        function addLog(msg) {
            logs.innerHTML += new Date().toLocaleTimeString() + ': ' + msg + '<br>';
            logs.scrollTop = logs.scrollHeight;
        }
        
        initBtn.addEventListener('click', async () => {
            initBtn.disabled = true;
            initBtn.textContent = 'Initializing...';
            await initializeDevice();
        });
        
        async function initializeDevice() {
            try {
                addLog('Requesting access token...');
                updateStatus('Getting access token...');
                
                const response = await fetch('/token');
                if (!response.ok) {
                    throw new Error('Failed to get access token');
                }
                
                const data = await response.json();
                addLog('Token received, creating device...');
                
                updateStatus('Initializing voice client...');
                
                device = new Device(data.token, {
                    logLevel: 'warn' // Reduced logging for production
                });
                
                device.on('ready', () => {
                    addLog('Voice client ready');
                    updateStatus('Ready to make calls', 'ready');
                    callBtn.disabled = false;
                    initBtn.style.display = 'none';
                });
                
                device.on('error', (error) => {
                    addLog('Error: ' + error.message);
                    updateStatus('Error: ' + error.message, 'error');
                });
                
                // Registration events (not required for outbound calls)
                device.on('registered', () => {
                    addLog('Device registered (enables incoming calls)');
                });
                
                device.on('unregistered', () => {
                    addLog('Device not registered (incoming calls disabled, outbound calls still work)');
                });
                
                device.on('connect', (conn) => {
                    addLog('Call connected');
                    updateStatus('Call in progress', 'ready');
                    connection = conn;
                    callBtn.disabled = true;
                    hangupBtn.disabled = false;
                });
                
                device.on('disconnect', () => {
                    addLog('Call ended');
                    updateStatus('Call ended', 'info');
                    connection = null;
                    callBtn.disabled = false;
                    hangupBtn.disabled = true;
                });
                
                // Enable calling after a short delay (registration not required for outbound)
                setTimeout(() => {
                    if (!callBtn.disabled) return; // Already enabled by 'ready' event
                    
                    addLog('Enabling outbound calling (registration not required)');
                    callBtn.disabled = false;
                    updateStatus('Ready to make outbound calls', 'ready');
                    initBtn.style.display = 'none';
                }, 2000);
                
            } catch (error) {
                addLog('Initialization failed: ' + error.message);
                updateStatus('Initialization failed: ' + error.message, 'error');
            }
        }
        
        callBtn.addEventListener('click', () => {
            addLog('Initiating call...');
            updateStatus('Connecting...');
            
            // Disable call button immediately
            callBtn.disabled = true;
            hangupBtn.disabled = false;
            
            try {
                connection = device.connect();
            } catch (error) {
                addLog('Call failed: ' + error.message);
                updateStatus('Call failed: ' + error.message, 'error');
                // Re-enable call button on error
                callBtn.disabled = false;
                hangupBtn.disabled = true;
            }
        });
        
        hangupBtn.addEventListener('click', () => {
            if (connection) {
                addLog('Ending call...');
                connection.disconnect();
            } else if (device) {
                // Fallback: disconnect all connections
                addLog('Ending call (fallback)...');
                device.disconnectAll();
            }
        });
    </script>
</body>
</html>
  `);
});

// Token endpoint
app.get('/token', (req, res) => {
  try {
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: APP_SID,
      incomingAllow: false
    });

    const token = new AccessToken(TWILIO_ACCOUNT_ID, TWILIO_API_KEY, TWILIO_API_SECRET, { 
      identity: CALLER_IDENTITY 
    });
    token.addGrant(voiceGrant);
    
    const jwt = token.toJwt();
    console.log('Access token generated');
    
    res.json({ token: jwt });
    
  } catch (error) {
    console.error('Token generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// TwiML webhook endpoint - handles outbound call routing
app.post(`/webhooks/${WEBHOOK_PATH}`, (req, res) => {
  console.log('Voice webhook called');
  
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Route call to SIP endpoint
  const dial = twiml.dial({
    callerId: CALLER_IDENTITY
  });
  
  dial.sip(SIP_URI);
  
  res.type('text/xml');
  res.send(twiml.toString());
});

// Status callback endpoint
app.post(`/webhooks/${WEBHOOK_PATH}/status`, (req, res) => {
  console.log('Call status update:', req.body.CallStatus);
  res.status(200).send('OK');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Configure your TwiML App Voice URL to: http://your-domain/webhooks/${WEBHOOK_PATH}`);
});