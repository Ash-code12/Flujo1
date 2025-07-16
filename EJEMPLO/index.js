const path = require('path');

const dotenv = require('dotenv');
const ENV_FILE = path.join(__dirname, '.env');
dotenv.config({ path: ENV_FILE });

const restify = require('restify');

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    createBotFrameworkAuthenticationFromConfiguration,
    MemoryStorage,
    ConversationState,
    UserState
} = require('botbuilder');

// This bot's main dialog.
const { VitaeBot } = require('./vitaebot');

const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

// console.log("MemoryStorage creado correctamente:", memoryStorage);
// console.log("ConversationState:", conversationState);
// console.log("UserState:", userState);


// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// ✅ Manejo de solicitudes OPTIONS (preflight para Teams)
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

server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`\n${ server.name } listening to ${ server.url }`);
});

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.MicrosoftAppId,
    MicrosoftAppPassword: process.env.MicrosoftAppPassword,
    MicrosoftAppType: process.env.MicrosoftAppType,
    MicrosoftAppTenantId: process.env.MicrosoftAppTenantId
});

const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new CloudAdapter(botFrameworkAuthentication);

// Catch-all for errors.
const onTurnErrorHandler = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights.
    console.error("Token de autorización fallido:", context?.activity?.serviceUrl);

    console.error(`\n [onTurnError] unhandled error: ${ error }`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${ error }`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send a message to the user
    await context.sendActivity('The bot encountered an error or bug.');
};

// Set the onTurnError for the singleton CloudAdapter.
adapter.onTurnError = onTurnErrorHandler;

// Create the main dialog.
const myBot = new VitaeBot(conversationState,userState);


server.post('/api/messages', async (req, res) => {
    console.log("➡️ Solicitud recibida en /api/messages");
    // Route received a request to adapter for processing
    // console.log("Headers recibidos:", JSON.stringify(req.headers, null, 2));
    await adapter.process(req, res, (context) => myBot.run(context));
});


// // Listen for Upgrade requests for Streaming.
// server.on('upgrade', async (req, socket, head) => {
    
//     const streamingAdapter = new CloudAdapter(botFrameworkAuthentication);
//     streamingAdapter.onTurnError = onTurnErrorHandler;
//     await streamingAdapter.process(req, socket, head, (context) => myBot.run(context));
// });

server.get('/', (req, res, next) => {
    res.send(200, 'Bot is running ✅');
    next();
});
