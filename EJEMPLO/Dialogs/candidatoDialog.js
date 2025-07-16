const {WaterfallDialog, ComponentDialog, DialogSet, DialogTurnStatus, Dialog } = require('botbuilder-dialogs');
const { ChoicePrompt, TextPrompt, DateTimePrompt, ConfirmPrompt, NumberPrompt, AttachmentPrompt } = require('botbuilder-dialogs');
const axios = require('axios');
const { CardFactory } = require('botbuilder');


const CHOICE_PROMPT         = 'CHOICE_PROMPT';
const CONFIRM_PROMPT        = 'CONFIRM_PROMPT';
const TEXT_PROMPT           = 'TEXT_PROMPT';
const NUMBER_PROMPT         = 'NUMBER_PROMPT';
const DATETIME_PROMPT       = 'DATETIME_PROMPT';
const WATERFALL_DIALOG      = 'WATERFALL_DIALOG';
const FILE_PROMPT           = 'FILE_PROMPT';
var endDialog               = '';



class CandidatoDialog extends ComponentDialog{
    constructor(conversationState,userState){
        super('candidatoDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));      
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this),      //Requerimiento de Informacion
            // this.secondStep.bind(this),     
            // this.thirdStep.bind(this),
            this.sendToWebHook.bind(this)   //Envio de informacion a n8n

        ]));

        this.initialDialogId = WATERFALL_DIALOG;

    }

    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this); 

        const dialogContext = await dialogSet.createContext(turnContext);

        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty){
            await dialogContext.beginDialog(this.id);
        }        
    }


        async firstStep(step) {
            await step.context.sendActivity("<br>📝 <b>Instrucción para usar el bot de búsqueda de candidatos</b><br><br>Por favor, escribe tu solicitud en un solo mensaje, siguiendo este estilo:<br><br>✅ <b>Incluye claramente:</b><ul><li><b>Cargos</b> que estás buscando (por ejemplo: <em>Web Developer, Backend Developer, Software Engineer</em>)</li><li><b>Ubicación</b> o país (por ejemplo: <em>Colombia, Bogotá, Medellín</em>)</li><li><b>Tecnologías o conocimientos técnicos</b> (por ejemplo: <em>Java, Spring Boot, Python, Web</em>)</li><li><b>Idioma u otro requisito adicional</b> si aplica (por ejemplo: <em>English</em>)</li></ul><hr>🔍 <b>Mensaje ejemplo:</b><br><br><em>Estoy buscando candidatos para <b>Web Developer</b> que estén localizados en <b>Colombia</b>, y que cuenten con conocimientos técnicos en <b>Java, Spring Boot, Web y Python</b>.</em><br><br><hr>💡 <b>Escribe tu solicitud con claridad y en este mismo formato.</b> Así el bot podrá procesarla correctamente y devolverte resultados útiles." );
            
            return await step.prompt(TEXT_PROMPT, 'Escribe la busqueda');
        }


        async sendToWebHook(step) {
            const context = step.context;
            step.values.userMessage = step.result;
            console.log("Entre a SEND WEBHOOK CANDIDATOS");
            console.log("URL DE WEB HOOK  "+ process.env.Candidato_n8n);
            console.log("MENSAJE DEL USUARIO  "+ step.values.userMessage);

            const webhookUrl = process.env.Candidato_n8n;
            let userMessage = (typeof step.values.userMessage === 'string') ? step.values.userMessage.trim() : "";
            if(userMessage === "" || userMessage === null || userMessage === undefined){
                userMessage = "No hay pregunta"
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
                await context.sendActivity("Estamos trabajando en su solicitud...");
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

            return await step.endDialog();
        }






}

module.exports.CandidatoDialog = CandidatoDialog;