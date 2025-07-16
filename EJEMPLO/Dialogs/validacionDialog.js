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


class ValidacionDialog extends ComponentDialog{
    constructor(conversationState,userState){
        super('validacionDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));      
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));
        this.addDialog(new AttachmentPrompt(FILE_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this),
            this.secondStep.bind(this),     //Requerimiento de Informacion
            this.thirdStep.bind(this),
            this.sendToWebHook.bind(this)   //Envio de informacion a n8n
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }


    async firstStep(step) {
        console.log("Primer Paso Validacion Dialog");
        step.values.haraPregunta = 'si';
        await step.context.sendActivity("<br>📝 <b>Instrucción para preguntar al archivo DT_Solicitudes_2025</b><br><br>Puedes interactuar con este bot de dos formas. Sigue las instrucciones según lo que necesites hacer:<br><br><ol><li><b>1. Realizar una pregunta directa sobre la información del archivo:</b><br><em>Ejemplo:</em><br><blockquote>¿Cuáles son las últimas 5 vacantes incluidas?</blockquote>➡️ <i>Escribe tu pregunta y presiona <b>Enter</b>.</i></li><br><li><b>2. Validar una solicitud específica adjuntando un archivo PDF:</b><br><em>Ejemplo:</em><br><blockquote>Valida la solicitud 1081</blockquote>➡️ <i>Escribe la solicitud y presiona <b>Enter</b>.</i><br>📎 <b>En el siguiente paso, se te pedirá adjuntar el archivo .pdf correspondiente.</b></li></ol><hr>💡 <b>Consejo:</b> Sé claro y específico en tu mensaje para obtener una respuesta precisa del bot.<br><br>");
        return await step.prompt(TEXT_PROMPT, "¿Qué desea hacer?<br><br><b>1.</b> Pregunta Directa<br><b>2.</b>Validar Solicitud", { retryPrompt:"No entendí tu opcion. Por favor, escribe nuevamente." });
    }


    async secondStep(step) {
        console.log("Segundo Paso Validacion Dialog");
        console.log("Resultado STEP -->", step.result);
        const resultado = (step.result || '').toLowerCase();

        if (step.result === '1' || step.result === 'pregunta directa') {
            step.values.tipoPregunta = 'pregunta';
            return await step.prompt(TEXT_PROMPT, "Perfecto! ✍️ <b>Por favor escriba su pregunta.</b>", { retryPrompt:"No entendí tu pregunta. Por favor, escribe nuevamente." });

        } else if (step.result === '2' || step.result === 'validar solicitud') {
            step.values.tipoPregunta = 'validar';
            return await step.prompt(TEXT_PROMPT, "Perfecto! ✍️ <b>Por favor escriba su solicitud antes de adjuntar el PDF.</b>", { retryPrompt:"No entendí tu pregunta. Por favor, escribe nuevamente." });

        } else {
            await step.context.sendActivity("Por favor seleccione una opción válida");
            return await step.replaceDialog(this.id);
        }
    }

    async thirdStep(step) {
        try{
            console.log("Tercer Paso Validacion Dialog");
            console.log("Resultado STEP -->", step.result);

            const pregunta = step.result?.value || step.result;
            step.values.userMessage = pregunta;
            console.log("Pregunta capturada paso 3 --> ", step.values.userMessage);

            if(step.values.tipoPregunta === 'validar'){
                return await step.prompt(FILE_PROMPT, "Por favor adjunte la hoja de vida en formato <b>.pdf</b>");

            } else if (step.values.tipoPregunta === 'pregunta') {
                // En caso de "pregunta directa", avanzamos al siguiente paso
                return await step.next();
            }

        } catch (error) {
            console.error("Error en thirdStep:", error);
            await step.context.sendActivity("Ocurrió un error interno al procesar tu respuesta.");
            return await step.endDialog();
        }
    }


    async sendToWebHook(step) {
        console.log("Entre a SEND WEBHOOK VITAE  accion a tomar --> ", step.values.tipoPregunta);
        console.log("RESPUESTA RECIBIDA del attachment:  "+ step.result);
        console.log("MENSAJE DEL USUARIO en WEBHOOK (pregunta) "+ step.values.userMessage);

        if(step.values.tipoPregunta === 'validar'){step.values.attachment = step.result};

        const context = step.context;
        const webhookUrl = process.env.Vitae_n8n;
        
        const userMessage = step.values.userMessage;
        const haraPregunta = step.values.haraPregunta;
        const accion = step.values.tipoPregunta;
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
        try{
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
module.exports.ValidacionDialog = ValidacionDialog;