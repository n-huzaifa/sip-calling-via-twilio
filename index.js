// server.js
import 'dotenv/config';
import express from 'express';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📋 Body:', req.body);
  }
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
  SIP_URI
} = process.env;

// Validate environment variables
if (!TWILIO_ACCOUNT_ID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !APP_SID || !SIP_URI) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

console.log('SIP URI:', SIP_URI);

// Simple frontend
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Simple SIP Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
        button { padding: 15px 30px; font-size: 16px; margin: 10px; border: none; border-radius: 5px; cursor: pointer; }
        #call { background: #28a745; color: white; }
        #hangup { background: #dc3545; color: white; }
        #status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .ready { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
        #debug { background: #f8f9fa; padding: 10px; margin: 10px 0; font-family: monospace; font-size: 12px; }
    </style>
</head>
<body>
    <h1>Simple SIP Test</h1>
    <p>Target: ${SIP_URI}</p>
    
    <div id="status" class="info">Starting...</div>
    <div id="debug"></div>
    
    <button id="call" disabled>Call SIP</button>
    <button id="hangup" disabled>Hang Up</button>
    <button id="initialize" style="background: #007bff; color: white; padding: 15px 30px; font-size: 16px; margin: 10px; border: none; border-radius: 5px; cursor: pointer;">Click to Initialize (Required)</button>

    <script type="module">
        // Load the UMD version and expose it as module
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/twilio-sdk/dist/twilio.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        // Now Twilio is available globally
        const { Device } = Twilio;
        
        let device = null;
        let connection = null;
        
        const status = document.getElementById('status');
        const debug = document.getElementById('debug');
        const callBtn = document.getElementById('call');
        const hangupBtn = document.getElementById('hangup');
        const initBtn = document.getElementById('initialize');
        
        function updateStatus(msg, type = 'info') {
            status.textContent = msg;
            status.className = type;
            console.log('STATUS:', msg);
        }
        
        function addDebug(msg) {
            debug.innerHTML += new Date().toLocaleTimeString() + ': ' + msg + '<br>';
            console.log('DEBUG:', msg);
        }
        
        // Step 1: SDK loaded, wait for user gesture
        addDebug('✅ Twilio SDK imported successfully');
        updateStatus('Click "Initialize" to start (required for audio)');
        
        initBtn.addEventListener('click', async () => {
            initBtn.disabled = true;
            initBtn.textContent = 'Initializing...';
            await init();
        });
        
        async function init() {
            try {
                addDebug('Step 2: Fetching token...');
                updateStatus('Step 2: Getting token...');
                
                const response = await fetch('/token');
                addDebug('Token response status: ' + response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error('HTTP ' + response.status + ': ' + errorText);
                }
                
                const data = await response.json();
                addDebug('✅ Token received');
                
                addDebug('Step 3: Creating Twilio Device...');
                updateStatus('Step 3: Initializing device...');
                
                device = new Device(data.token, {
                    debug: true,
                    logLevel: 'debug'
                });
                
                // Add more event listeners for debugging
                device.on('ready', () => {
                    addDebug('✅ Device ready!');
                    updateStatus('Ready to call!', 'ready');
                    callBtn.disabled = false;
                    initBtn.style.display = 'none';
                });
                
                device.on('error', (error) => {
                    addDebug('❌ Device error: ' + error.message);
                    addDebug('Error code: ' + (error.code || 'No code'));
                    addDebug('Error details: ' + JSON.stringify(error, null, 2));
                    updateStatus('Device error: ' + error.message, 'error');
                });
                
                device.on('offline', () => {
                    addDebug('📴 Device went offline');
                });
                
                device.on('registering', () => {
                    addDebug('🔄 Device registering with Twilio...');
                    updateStatus('Registering with Twilio...');
                });
                
                device.on('registered', () => {
                    addDebug('✅ Device registered successfully!');
                    updateStatus('Device registered!', 'ready');
                });
                
                device.on('unregistered', () => {
                    addDebug('❌ Device unregistered - check TwiML App Voice URL!');
                    updateStatus('Failed to register - check TwiML App config', 'error');
                });
                
                device.on('incoming', (call) => {
                    addDebug('📞 Incoming call');
                });
                
                device.on('connect', (conn) => {
                    addDebug('✅ Call connected');
                    updateStatus('Connected!', 'ready');
                    connection = conn;
                    callBtn.disabled = true;
                    hangupBtn.disabled = false;
                });
                
                device.on('disconnect', () => {
                    addDebug('Call disconnected');
                    updateStatus('Call ended', 'info');
                    connection = null;
                    callBtn.disabled = false;
                    hangupBtn.disabled = true;
                });
                
                // Add more detailed event debugging
                device.on('tokenWillExpire', () => {
                    addDebug('⚠️ Token will expire soon');
                });
                
                device.on('destroy', () => {
                    addDebug('🔥 Device destroyed');
                });
                
                addDebug('Device created, waiting for ready event...');
                
                // Try to force call anyway after a few seconds (bypass registration check)
                setTimeout(() => {
                    if (!device.isReady) {
                        addDebug('💡 Trying to enable call anyway...');
                        callBtn.disabled = false;
                        callBtn.style.background = '#ffc107';
                        callBtn.textContent = 'Try Call Anyway';
                        updateStatus('Registration failed, but you can try calling', 'warning');
                    }
                }, 5000);
                
            } catch (error) {
                addDebug('❌ Initialization failed: ' + error.message);
                updateStatus('Failed: ' + error.message, 'error');
                console.error('Full error:', error);
            }
        }
        
        callBtn.addEventListener('click', () => {
            addDebug('Calling device.connect()...');
            updateStatus('Calling...');
            device.connect();
        });
        
        hangupBtn.addEventListener('click', () => {
            if (connection) {
                addDebug('Disconnecting...');
                connection.disconnect();
            }
        });
    </script>
</body>
</html>
  `);
});

// Token endpoint
app.get('/token', (req, res) => {
  console.log('Token request received');
  
  try {
    const identity = 'sipuser';
    
    console.log('Creating token with:');
    console.log('- Account SID:', TWILIO_ACCOUNT_ID);
    console.log('- API Key:', TWILIO_API_KEY);
    console.log('- App SID:', APP_SID);
    console.log('- Identity:', identity);
    
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: APP_SID,
      incomingAllow: false
    });

    const token = new AccessToken(TWILIO_ACCOUNT_ID, TWILIO_API_KEY, TWILIO_API_SECRET, { identity });
    token.addGrant(voiceGrant);
    
    const jwt = token.toJwt();
    console.log('Token generated successfully');
    console.log('Token length:', jwt.length);
    
    res.json({ token: jwt });
    
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// TwiML endpoint - this is where Twilio calls when you click "Call"
app.post('/webhooks/twilio/cmb5v3a6b0001pofthcngifxq/initiate', (req, res) => {
  console.log('🎯 Voice webhook called - SUCCESS!');
  console.log('📋 Request body:', req.body);
  
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Create dial instruction with SIP-compatible caller ID
  const dial = twiml.dial({
    callerId: 'sipuser'  // Simple alphanumeric caller ID for SIP
  });
  
  // Add SIP endpoint
  dial.sip(SIP_URI);
  
  console.log('📤 TwiML response:', twiml.toString());
  
  res.type('text/xml');
  res.send(twiml.toString());
});

// Add status callback endpoint to avoid 404s
app.post('/webhooks/twilio/cmb5v3a6b0001pofthcngifxq/status', (req, res) => {
  console.log('📊 Call status callback:', req.body);
  res.status(200).send('OK');
});

// Catch-all for debugging what paths Twilio is trying to hit
app.all('*', (req, res) => {
  console.log(`❓ Unknown route attempted: ${req.method} ${req.path}`);
  console.log('📋 Headers:', req.headers);
  console.log('📋 Body:', req.body);
  res.status(404).send('Route not found - check console for debugging');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('TwiML App Voice URL is already configured correctly!');
  console.log('🔍 Debug mode: All requests will be logged');
});