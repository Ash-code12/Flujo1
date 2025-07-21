const { ActivityHandler, MessageFactory, CardFactory } = require('botbuilder');
const { DialogSet, DialogTurnStatus, MemoryStorage, ConversationState, UserState, TextPrompt } = require('botbuilder-dialogs');
const { VitaeDialog } = require('./Dialogs/vitaeDialog');
const { CandidatoDialog } = require('./Dialogs/candidatoDialog');
const { ValidacionDialog } = require('./Dialogs/validacionDialog');
const SolicitudDialog = require('./Dialogs/solicitudDialog');

const axios = require('axios');

class VitaeBot extends ActivityHandler {
    constructor(conversationState, userState) {
        super();

        this.conversationState = conversationState;
        this.userState = userState;

        this.dialogState = this.conversationState.createProperty("dialogState");
        this.userDataAccessor = userState.createProperty("userData");
        this.conversationData = this.conversationState.createProperty("conversationData");
        this.dialogs = new DialogSet(this.dialogState);

        this.dialogs.add(new TextPrompt('TEXT_PROMPT'));
        this.dialogs.add(new VitaeDialog("vitaeDialog"));
        this.dialogs.add(new CandidatoDialog("candidatoDialog"));
        this.dialogs.add(new ValidacionDialog("validacionDialog"));
        this.dialogs.add(new SolicitudDialog());
        //this.dialogs.add(new SolicitudDialog(conversationState, userState));  //Parametros

        // Informacion del usuario guardada
        this.onDialog(async (context, next) => {
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        });

        this.onMessage(async (context, next) => {
            const userData = await this.userDataAccessor.get(context, {});
    
            // Primero define userMessage correctamente
            let userMessage = (typeof context.activity.text === 'string') 
                ? context.activity.text.trim().toLowerCase() 
                : '';

            console.log("Mensaje del usuario OnMessage: ->", userMessage);
            console.log("ACTIVITY COMPLETA >>>", JSON.stringify(context.activity, null, 2));

            // Continuar diálogo si ya hay uno en curso
            const dialogContext = await this.dialogs.createContext(context);
            const dialogTurnResult = await dialogContext.continueDialog();
            console.log("Estado del diálogo: ----> ", dialogTurnResult.status);
            
            switch (dialogTurnResult.status) {
                case DialogTurnStatus.waiting:
                    // 🔒 Diálogo activo esperando input → no hacer nada más
                    return;

                case DialogTurnStatus.complete: 
                    console.log("Dialogo Completado");
                    // No break - continuar al siguiente case
                case DialogTurnStatus.cancelled: 
                    console.log("Dialogo Cancelado");
                    // No break - continuar al siguiente case
                case DialogTurnStatus.empty:
                    console.log("Diálogo Vacío o nuevo");
                    
                    // 🟢 El diálogo terminó o no hay uno activo → mostrar bienvenida y opciones
                    await this.checkAndSendWelcomeMessage(context);

                    // Detectar palabra clave en el mensaje para seleccionar opción automáticamente
                    switch (userMessage) {
                        case "vitae":
                            console.log("Opción seleccionada: vitae");
                            userData.selectedOption = "vitae";
                            break;

                        case "busqueda":
                            console.log("Opción seleccionada: busqueda");
                            userData.selectedOption = "busqueda";
                            break;

                        case "validacion":
                            console.log("Opción seleccionada: validacion");
                            userData.selectedOption = "validacion";
                            break;
                            
                        case "solicitud": 
                            console.log("Opción seleccionada: solicitud");
                            userData.selectedOption = "solicitud";
                            break;

                        
                        default:
                            console.log("Opción seleccionada: Sin opción seleccionada");
                            userData.selectedOption = "sinOpcion";
                            break;
                    }
                    console.log("Respuesta de opción: " + userData.selectedOption);

                    // Si no se detecta opción válida, mostrar tarjeta con opciones
                    if (!userData.selectedOption || userData.selectedOption === "sinOpcion") {
                        console.log("No hay opción seleccionada. Enviando tarjeta.");
                        await this.sendOptionsCard(context, userMessage);

                    } else {
                        // Iniciar el diálogo según la opción elegida
                        switch (userData.selectedOption) {
                            case "vitae":
                                await dialogContext.beginDialog("vitaeDialog");
                                break;

                            case "busqueda":
                                await dialogContext.beginDialog("candidatoDialog");
                                break;

                            case "validacion":
                                await dialogContext.beginDialog("validacionDialog");
                                break;

                            case "solicitud":
                                await dialogContext.beginDialog("solicitudDialog");
                                break;

                        }

                        // Limpiar opción después de usarla
                        userData.selectedOption = "";
                        await this.userDataAccessor.set(context, userData);
                        await this.userState.saveChanges(context);
                    }
                    break;

                default:
                    console.warn("Estado desconocido del diálogo:", dialogTurnResult.status);
                    break;
            }
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            for (const member of context.activity.membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    await this.checkAndSendWelcomeMessage(context);
                }
            }
            await next();
        });
    }

    async checkAndSendWelcomeMessage(turnContext) {
        const userData = await this.userDataAccessor.get(turnContext, {});
        const currentTime = Date.now();
        const lastInteractionTime = userData.lastInteractionTime;


        if (!lastInteractionTime || (currentTime - lastInteractionTime) > 21600000) { 
            const welcomeMessage = `Me alegro que estés aquí, ${turnContext.activity.from.name}`;
            const initialWelcome = 'Bienvenido a nuestro chat de Automatizacion de Recursos Humanos en Softgic.';
            
            await turnContext.sendActivity(welcomeMessage);
            await turnContext.sendActivity(initialWelcome);

            userData.lastInteractionTime = currentTime;
            await this.userDataAccessor.set(turnContext, userData);
            await this.userState.saveChanges(turnContext);
        }
    }

    async sendOptionsCard(context) {
        const heroCard = CardFactory.heroCard(
            '¿Qué deseas hacer?',
            null,
            [
                { type: 'imBack', title: '📝 Registrar nueva solicitud', value: 'solicitud' },
                { type: 'imBack', title: '🔍 Validación ID Solicitud', value: 'consultar' },
                { type: 'imBack', title: '👤 Búsqueda de candidato', value: 'candidato' },
            ]
        );

        await context.sendActivity({ attachments: [heroCard] });
    }

    async run(context) {
        await super.run(context); // Ejecuta onMessage, onMembersAdded, etc.

        await this.conversationState.saveChanges(context, false);
        await this.userState.saveChanges(context, false);
    }

    // Envía el mensaje recibido al webhook de n8n y procesa la respuesta
    async sendToWebhook(context) {
        console.log("Entre a SEND WEBHOOK VITAE");
        const webhookUrl = 'https://n8n-esencia-suite.zntoks.easypanel.host/webhook/4bbcf5ec-82d2-4f70-92e4-db6e5808a36d';
        let userMessage = (typeof context.activity.text === 'string') ? context.activity.text.trim() : "";
        if(userMessage === "" || userMessage === null || userMessage === undefined){
            userMessage = "Español"
        }
        const userId = context.activity.from.id;
        const userName = context.activity.from.name;
        const userObject = context.activity.from.aadObjectId;
        const chatId = context.activity.conversation.id;

        // Objeto que se enviará al webhook
        const payload = { 
            message: userMessage,
            chatId: chatId,
            userId: userId,
            userName: userName,
            userObject: userObject,
            attachments: []
        };

        // Verificar si hay archivos adjuntos
        if (context.activity.attachments && context.activity.attachments.length > 0) {
            for (const attachment of context.activity.attachments) {
                let fileUrl = '';
                let fileName = attachment.name || 'archivo-sin-nombre';

                if (attachment.contentType === 'application/vnd.microsoft.teams.file.download.info' && attachment.content && attachment.content.downloadUrl) {
                    fileUrl = attachment.content.downloadUrl;
                } else {
                    fileUrl = attachment.contentUrl;
                }
                
                payload.attachments.push({
                    name: fileName,
                    contentUrl: fileUrl,
                    contentType: attachment.contentType
                });
            }
        }

        try {
            console.log("MENSAJE ENVIADO A N8N", JSON.stringify(payload, null, 2));
            const response = await axios.post(webhookUrl, payload);
            console.log("Tipo de respuesta:", typeof response.data);
            console.log("Contenido de respuesta:", JSON.stringify(response.data, null, 2));

            console.log("Respuesta del webhook:", response.data);
            
            let replyMessage = 'El aplicativo se encuentra en mantenimiento.';
            if (Array.isArray(response.data) && response.data.length > 0) {
                replyMessage = response.data[0].text || replyMessage;
            }

            await context.sendActivity(replyMessage);
            
        } catch (error) {
            console.error('Error enviando al webhook:', error);
            await context.sendActivity('Ocurrió un error al procesar tu mensaje.');
        }
    }

    async sendToWebhookCandidatos(context) {
        console.log("Entre a SEND WEBHOOK CANDIDATOS");
        const webhookUrl = 'https://n8n-esencia-suite.zntoks.easypanel.host/webhook/b2dbdfc6-c340-4931-9a55-dcd972506aa1';
        const userMessage = context.activity.text || '';
        const { id: userId, name: userName } = context.activity.from;
        const chatId = context.activity.conversation.id;

        const payload = {
            message: userMessage,
            chatId,
            userId,
            userName
        };

        try {
            console.log("MENSAJE ENVIADO A n8n Candidatos", JSON.stringify(payload, null, 2));
            const response = await axios.post(webhookUrl, payload);
            const reply = (Array.isArray(response.data) && response.data[0]?.text)
                ? response.data[0].text
                : "Solicitud enviada al sistema de búsqueda de candidatos.";
            await context.sendActivity(reply);

            // Nota: Esta línea parece estar fuera de contexto, podría necesitar ser removida
            // return await step.endDialog();
        } catch (error) {
            console.error("Error Webhook Candidatos:", error);
            await context.sendActivity("Error al buscar candidatos.");
        }
    }
}

module.exports.VitaeBot = VitaeBot;