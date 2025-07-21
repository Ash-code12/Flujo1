const path = require('path');
const dotenv = require('dotenv');
const restify = require('restify');

// Cargar variables de entorno
const ENV_FILE = path.join(__dirname, '.env');
dotenv.config({ path: ENV_FILE });

// Import required bot services
const {
    CloudAdapter,
    ConfigurationBotFrameworkAuthentication,
    MemoryStorage,
    ConversationState,
    UserState
} = require('botbuilder');

// Import main bot dialog
const { VitaeBot } = require('./vitaebot');

// Initialize storage and state
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

console.log("✅ Storage y States inicializados correctamente");

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// CORS headers for Teams compatibility
server.pre((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.send(200);
        return;
    }

    next();
});

// Start server
const port = process.env.PORT || process.env.port || 3978;
server.listen(port, () => {
    console.log(`🚀 ${server.name} listening on ${server.url}`);
});

// Bot Framework Authentication
const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: process.env.MicrosoftAppId || '',
    MicrosoftAppPassword: process.env.MicrosoftAppPassword || '',
});

// Create adapter
const adapter = new CloudAdapter(botFrameworkAuthentication);

// Error handling
const onTurnErrorHandler = async (context, error) => {
    console.error(`❌ [onTurnError] unhandled error: ${error}`);
    console.error("Service URL:", context?.activity?.serviceUrl);

    // Send trace activity for debugging
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${error}`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send error message to user
    await context.sendActivity('❌ El bot encontró un error. Por favor, intenta nuevamente.');
};

// Set error handler
adapter.onTurnError = onTurnErrorHandler;

// Create bot instance
const myBot = new VitaeBot(conversationState, userState);

// Main bot endpoint
server.post('/api/messages', async (req, res) => {
    console.log("➡️ Solicitud recibida en /api/messages");
    try {
        await adapter.process(req, res, (context) => myBot.run(context));
    } catch (error) {
        console.error("❌ Error procesando mensaje:", error);
        res.send(500, { error: 'Internal server error' });
    }
});

// Health check endpoint
server.get('/', (req, res, next) => {
    res.send(200, { 
        message: 'Bot is running ✅',
        timestamp: new Date().toISOString(),
        status: 'healthy'
    });
    next();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log("✅ Servidor configurado correctamente");