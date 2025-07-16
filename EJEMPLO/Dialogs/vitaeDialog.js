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


class VitaeDialog extends ComponentDialog{
    constructor(conversationState,userState){
        super('vitaeDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));      
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));
        this.addDialog(new AttachmentPrompt(FILE_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this),
            this.secondStep.bind(this),     //Requerimiento de Informacion
            // this.thirdStep.bind(this),
            // this.fourthStep.bind(this),
            this.sendToWebHook.bind(this)   //Envio de informacion a n8n

        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }


    async firstStep(step) {
        console.log("Primer Paso");
        step.values.haraPregunta = 'no';

        return await step.prompt(CHOICE_PROMPT, {
            prompt: 'Vamos a generar una hoja de vida en formato SOFTGIC. <br><br>Seleccione el <b>idioma</b> esperado para la hoja de vida:',
            choices: [
                { value: 'Español' },
                { value: 'Inglés' }
            ]
        });
    }


    async secondStep(step) {
        const respuesta = step.result.value || step.result;
        try{
            console.log("STEP 2 --------- Esta es la respuesta recibida del STEP 1:  ", respuesta);
            console.log("DEBUG secondStep: step.result =", JSON.stringify(step.result));

            const idioma = step.result?.value || step.result;
            step.values.userMessage = idioma;
            return await step.prompt(FILE_PROMPT, "Por favor adjunte la hoja de vida en formato <b>.pdf</b>");
        } catch (error) {
            console.error("Error en thirdStep:", error);
            await step.context.sendActivity("Ocurrió un error interno al procesar tu respuesta.");
            return await step.endDialog();
        }
    }


    async sendToWebHook(step) {
        console.log("Entre a SEND WEBHOOK VITAE");
        console.log("RESPUESTA RECIBIDA del attachment:  "+ step.result);

        step.values.attachment = step.result;
        const context = step.context;
        
        console.log("MENSAJE DEL USUARIO en WEBHOOK  "+ step.values.userMessage);

        const webhookUrl = process.env.Vitae_n8n;
        let userMessage = (typeof step.values.userMessage === 'string') ? step.values.userMessage.trim() : "";
        if(userMessage === "" || userMessage === null || userMessage === undefined){
            userMessage = "Español"
        }
        const haraPregunta = step.values.haraPregunta;
        const accion = step.values.accion;
        const userId = context.activity.from.id;
        const userName = context.activity.from.name;
        const userObject = context.activity.from.aadObjectId;
        const chatId = context.activity.conversation.id;

        // Objeto que se enviará al webhook
        const payload = { 
            message: userMessage,
            haraPregunta: haraPregunta,
            accion: accion,
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

module.exports.VitaeDialog = VitaeDialog;

