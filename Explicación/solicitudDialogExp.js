const { ComponentDialog, WaterfallDialog, TextPrompt } = require('botbuilder-dialogs');  //Importaciones del paquete botbuilder....
//agrupar dialogos, dialogo paso a paso, espera respuesta de usuario 

const { MessageFactory } = require('botbuilder');  //Construye mensajes que el bot puede enviar
const fetch = require('node-fetch');  //Permite hacer solicitudes HTTP (Webhook)

//Identificadores para dialogos (ID)
const TEXT_PROMPT = 'TEXT_PROMPT';  
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class SolicitudDialog extends ComponentDialog {  
    constructor() {
        super('solicitudDialog');

        //Dialogos
        this.addDialog(new TextPrompt(TEXT_PROMPT));  //Respuestas de texto
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [   //Dialogo en cascada

//Método atado al contexto de la clase .bind(this), preguntar procesar
            this.preguntarMetodo.bind(this),  
            this.procesarMetodo.bind(this),
            this.procesarDatos.bind(this),
            this.preguntarCliente.bind(this),
            this.preguntarOrigen.bind(this),
            this.preguntarUsuario.bind(this),
            this.preguntarTipoPerfil.bind(this),
            this.preguntarSkills.bind(this),
            this.preguntarPrioridadStep.bind(this),
            this.preguntarValor.bind(this),
            this.preguntarCiudadStep.bind(this),
            this.finalizarSolicitud.bind(this) 
            ]));

        this.initialDialogId = WATERFALL_DIALOG;  //Cuál dialogo se ejecutará al iniciar
    }

    async preguntarMetodo(stepContext) {  //Primer paso
        await stepContext.context.sendActivity(
            '📋 *¿Cómo deseas continuar?*\n\n' +
            '1. 📎 Subir documento\n' +
            '2. ✍️ Escribir manualmente\n' +
            '3. ❌ Cancelar\n\n' +
            'Por favor responde con el número de la opción (ejemplo: "1").'
        );
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' }); //Espera respuesta del usuario
    }


//Captura lo que el usuario respondió y lo limpia con .trim()    
    async procesarMetodo(stepContext) {
        const respuesta = stepContext.result?.trim();

 //Actuar según la opción       
        switch (respuesta) {
            case '1':
                await stepContext.context.sendActivity('📎 Elegiste subir un documento. Por favor, sube un archivo PDF con la información de la solicitud.');
                stepContext.values.metodo = 'documento';
                stepContext.values.esperandoDocumento = true;
                return await stepContext.next();
            case '2':
                await stepContext.context.sendActivity('✍️ Elegiste llenar los campos manualmente.');
                stepContext.values.metodo = 'manual';
                stepContext.values.esperandoDocumento = false;
                return await stepContext.next();
            case '3':
                await stepContext.context.sendActivity('❌ Operación cancelada.');
                return await stepContext.cancelAllDialogs();
            default:
                await stepContext.context.sendActivity('❌ Opción no válida. Responde con un número entre 1 y 3.');
                return await stepContext.replaceDialog('solicitudDialog');
        }
    }

//Si respuesta fue documento llama a otro metodo para recibir archivo 
    async procesarDatos(stepContext) {
        console.log("Respuesta recibida ProcesarDaos --> ",stepContext.values)
        if (stepContext.values.metodo === 'documento') {
            return await this.procesarDocumento(stepContext);
        } else {
            return await stepContext.next();
        }
    }

//Extrae el mensaje para ver si viene con archivo adjunto    
    async procesarDocumento(stepContext) {
        console.log("Esto es procesarDocumento --->",stepContext.context.activity);
        const activity = stepContext.context.activity;

//Si manda archivo lo toma
        if (activity.attachments && activity.attachments.length > 0) {
            const attachment = activity.attachments[0];
 
//Verifica que es PDF 
            if (attachment.contentType === 'application/pdf' || 
                attachment.name?.toLowerCase().endsWith('.pdf')) {
             
//Muestra mensaje extrae los datos y los guarda en values
                await stepContext.context.sendActivity('📄 Archivo PDF recibido. Procesando documento...');
                
                try {
                    const datosExtraidos = await this.extraerDatosPDF(attachment);
                    Object.assign(stepContext.values, datosExtraidos);
                    
                    await stepContext.context.sendActivity('✅ Documento procesado exitosamente. Datos extraídos correctamente.');
                    
                    return await stepContext.next('documento_procesado');
                } catch (error) {
                    await stepContext.context.sendActivity('❌ Error al procesar el PDF. Continuemos de forma manual.');
                    stepContext.values.metodo = 'manual';
                    stepContext.values.esperandoDocumento = false;
                    return await stepContext.next();
                }
            } else {
                await stepContext.context.sendActivity('❌ El archivo debe ser un PDF. Por favor, sube un archivo PDF válido.');
                return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
            }
        } else {
            await stepContext.context.sendActivity('📎 No se ha recibido ningún archivo. Por favor, sube un archivo PDF.');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }
    }

//Usa pdfProcessor para leer pdf y devolver un objeto con los datos
  /*  async extraerDatosPDF(attachment) {
        try {
            const datosExtraidos = await this.pdfProcessor.procesarPDF(attachment);
            return datosExtraidos;
        } catch (error) {
            console.error('Error procesando PDF:', error);
            throw error;
        }
    }*/

    async preguntarCliente(stepContext) {
        if (stepContext.result === 'documento_procesado') {
            return await stepContext.next('saltar_preguntas');
        }
        
        if (stepContext.values.metodo === 'manual') {
            await stepContext.context.sendActivity('🧾 Vamos a comenzar. ¿Cuál es el nombre del *cliente*?');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }   //stepContext donde se guardan las respuestas 
        
        return await stepContext.next();
    }

    async preguntarOrigen(stepContext) {
        if (stepContext.result === 'saltar_preguntas') {
            return await stepContext.next('saltar_preguntas');
        }
        
        if (stepContext.values.metodo === 'manual') {
            stepContext.values.cliente = stepContext.result;
            await stepContext.context.sendActivity('🌐 ¿Cuál es el *origen* de la solicitud?');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }
        
        return await stepContext.next();
    }

    async preguntarUsuario(stepContext) {
        if (stepContext.result === 'saltar_preguntas') {
            return await stepContext.next('saltar_preguntas');
        }
        
        if (stepContext.values.metodo === 'manual') {
            stepContext.values.origen = stepContext.result;
            await stepContext.context.sendActivity('👤 ¿Quién es el *usuario solicitante*?');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }
        
        return await stepContext.next();
    }

    async preguntarTipoPerfil(stepContext) {
        if (stepContext.result === 'saltar_preguntas') {
            return await stepContext.next('saltar_preguntas');
        }
        
        if (stepContext.values.metodo === 'manual') {
            stepContext.values.usuarioSolicitante = stepContext.result;
            await stepContext.context.sendActivity('👔 ¿Cuál es el *tipo de perfil* que se está solicitando?');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }
        
        return await stepContext.next();
    }

    async preguntarSkills(stepContext) {
        if (stepContext.result === 'saltar_preguntas') {
            return await stepContext.next('saltar_preguntas');
        }
        
        if (stepContext.values.metodo === 'manual') {
            stepContext.values.tipoPerfil = stepContext.result;
            await stepContext.context.sendActivity('🛠️ ¿Qué *skills* debe tener el candidato? (separadas por comas)');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }
        
        return await stepContext.next();
    }

    async preguntarPrioridadStep(stepContext) {
        if (stepContext.result === 'saltar_preguntas') {
            return await stepContext.next('saltar_preguntas');
        }
        
        if (stepContext.values.metodo === 'manual') {
            stepContext.values.skills = stepContext.result;
            await stepContext.context.sendActivity('⚠️ ¿Cuál es la *prioridad* de la solicitud? (Alta, Media, Baja)');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }
        
        return await stepContext.next();
    }

    async preguntarValor(stepContext) {
        if (stepContext.result === 'saltar_preguntas') {
            return await stepContext.next('saltar_preguntas');
        }
        
        if (stepContext.values.metodo === 'manual') {
            stepContext.values.prioridad = stepContext.result;
            await stepContext.context.sendActivity('💰 ¿Cuál es el *valor de la oportunidad*?');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }
        
        return await stepContext.next();
    }

    async preguntarCiudadStep(stepContext) {
        if (stepContext.result === 'saltar_preguntas') {
            return await stepContext.next('saltar_preguntas');
        }
        
        if (stepContext.values.metodo === 'manual') {
            stepContext.values.valorOportunidad = stepContext.result;
            await stepContext.context.sendActivity('📍 ¿En qué *ciudad* se requiere el candidato?');
            return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
        }
        
        return await stepContext.next();
    }

    async finalizarSolicitud(stepContext) {
        if (stepContext.values.metodo === 'manual' && stepContext.result !== 'saltar_preguntas') {
            stepContext.values.ciudad = stepContext.result;
        }

        const solicitud = stepContext.values; //Se extraen los valores guardados

        // Enviar datos al webhook antes de mostrar el resumen
        try {
            await this.enviarDatosWebhook(solicitud, stepContext);
        } catch (error) {
            console.error('Error enviando datos al webhook:', error);
        }

        const resumen = `
📋 **Solicitud Creada Exitosamente**

✅ **Método:** ${solicitud.metodo}
✅ **Cliente:** ${solicitud.cliente || 'N/A'}
✅ **Origen:** ${solicitud.origen || 'N/A'}
✅ **Usuario Solicitante:** ${solicitud.usuarioSolicitante || 'N/A'}
✅ **Tipo de Perfil:** ${solicitud.tipoPerfil || 'N/A'}
✅ **Skills:** ${solicitud.skills || 'N/A'}
✅ **Prioridad:** ${solicitud.prioridad || 'N/A'}
✅ **Valor de Oportunidad:** ${solicitud.valorOportunidad || 'N/A'}
✅ **Ciudad:** ${solicitud.ciudad || 'N/A'}

¡La solicitud ha sido registrada correctamente! 🎉
`;

        await stepContext.context.sendActivity(resumen);
        console.log("📋 Solicitud completada:", solicitud);

        return await stepContext.endDialog(solicitud);
    }

    async enviarDatosWebhook(solicitud, stepContext) {  //Arma el objeto que se va a enviar 
        try {
            const activity = stepContext.context.activity;
    
            const payload = {
                ...solicitud,
                replyToId: activity.id,
                conversationId: activity.conversation.id,
                serviceUrl: activity.serviceUrl
            };
    
            const response = await fetch('https://mashley.app.n8n.cloud/webhook-test/simulacion-bot', {
                method: 'POST', //Envía a una URL externa flujo en n8n
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            console.log('Datos enviados al webhook exitosamente:', data);
            return data;
    
        } catch (error) {
            console.error('Error enviando datos al webhook:', error);
            throw error;
        }
    }
}

    module.exports = SolicitudDialog;  //Exporta la clase para que se pueda usar en otro archivo