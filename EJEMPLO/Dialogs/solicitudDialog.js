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

class SolicitudDialog extends ComponentDialog {
    constructor(conversationState,userState){
        super('solicitudDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));      
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));
        this.addDialog(new AttachmentPrompt(FILE_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this),
            this.secondStep.bind(this),
            this.thirdStep.bind(this),
            this.fourthStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async firstStep(step) {
        console.log("Primer Paso Solicitud Dialog");
        step.values.haraPregunta = 'si';
        
        const instructivo = 
            "🚀 <b>Bot de Registro de Solicitudes</b><br><br>" +
            "📝 Registra solicitudes en Excel <b>DT_Solicitudes2025</b><br>" +
            "La IA organiza automáticamente la información de Skills<br>" +
            "Puedes ingresar campos opcionales: Cliente Solvo, Lab, Rango Salarial<br>";

        await step.context.sendActivity(instructivo);

        return await step.prompt(TEXT_PROMPT, 
            "📝 <b>Ingresa los campos:</b><br>" +
            "Cliente:<br>" +
            "Origen Solicitud: USA o COL<br>" +
            "Usuario Solicita: <br>" +
            "Tipo Perfil: <br>" +
            "Prioridad: [alta/media/baja]<br>" +
            "Ciudad: ", 
            { retryPrompt:"❌ No entendí. Intenta de nuevo." });
    }

    async secondStep(step) {
        console.log("Segundo Paso Solicitud Dialog");
        console.log("Resultado STEP -->", step.result);
    
        const userInput = step.result || '';
        const camposObligatorios = [
            'Cliente',
            'Origen Solicitud', 
            'Usuario Solicita',
            'Tipo Perfil',
            'Prioridad',
            'Ciudad'
        ];
        
        const faltantes = camposObligatorios.filter(campo => 
            !userInput.toLowerCase().includes(campo.toLowerCase())
        );

        if (faltantes.length > 0) { 
            return await step.prompt(TEXT_PROMPT, 
                `⚠️ <b>Faltan campos obligatorios:</b> ${faltantes.join(', ')}<br><br>Por favor ingrese los campos faltantes en formato: <b>Campo: Valor</b>`, 
                { retryPrompt: "Por favor, ingrese los campos en el formato correcto." }
            );
        }
        
        step.values.todosLosCampos = userInput;
        return await step.next();
    }

    async thirdStep(step) {
        console.log("Tercer Paso - Skills Dialog");
        console.log("Resultado STEP -->", step.result);

        if (step.result && !step.values.todosLosCampos) {
            step.values.todosLosCampos = step.result;
        }

        return await step.prompt(TEXT_PROMPT, 
            "🎯 <b>Ingresa información de Skills:</b><br>" +
            "Responsabilidades, requisitos, tecnologías, experiencia, etc.",
            { retryPrompt: "❌ Por favor ingresa la información de Skills." }
        );
    }

    async fourthStep(step) {
        console.log("Cuarto Paso - Procesamiento Final");
        console.log("Resultado STEP -->", step.result);

        step.values.skillsInfo = step.result;

        const datosParaEnvio = {
            campos: step.values.todosLosCampos,
            tipoSkills: 'manual', // Siempre manual ahora
            skillsInfo: step.values.skillsInfo,
            fechaCreacion: new Date().toISOString()
        };

        await step.context.sendActivity("⏳ <b>Procesando por favor espera un momento...</b>");

        try {
            const response = await axios.post('https://n8n-esencia-suite.zntoks.easypanel.host/webhook/simulacion-bot', datosParaEnvio, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.status === 200) {
                await step.context.sendActivity({
                    type: 'message',
                    text: response.data.mensaje,
                    textFormat: 'xml'
                });
                
                if (response.data.idSolicitud) {
                    await step.context.sendActivity(`📋 <b>ID de Solicitud:</b> ${response.data.idSolicitud}`);
                }
            } else {
                await step.context.sendActivity("❌ <b>Error al procesar la solicitud.</b><br>Por favor intente nuevamente.");
            }

        } catch (error) {
            console.error("Error enviando a n8n:", error);
            await step.context.sendActivity("❌ <b>Error de conexión.</b><br>Por favor intente más tarde.");
        }
        
        return await step.endDialog();
    }
}

module.exports.SolicitudDialog = SolicitudDialog;