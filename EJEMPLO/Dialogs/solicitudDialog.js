const { ComponentDialog, WaterfallDialog, TextPrompt } = require('botbuilder-dialogs');
const { MessageFactory } = require('botbuilder');
return await stepContext.replaceDialog(this.id);


const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class SolicitudDialog extends ComponentDialog {
    constructor(id) {
        super(id);

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.preguntarMetodo.bind(this),
            this.procesarMetodo.bind(this),
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

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async preguntarMetodo(stepContext) {
        await stepContext.context.sendActivity(
        '📋 *¿Cómo deseas continuar?*\n\n' +
        '1. 📎 Subir documento\n' +
        '2. ✍️ Escribir manualmente\n' +
        '3. ❌ Cancelar\n\n' +
        'Por favor responde con el número de la opción (ejemplo: "1").'
    );
    return await stepContext.prompt('TEXT_PROMPT', { prompt: '' }); // Espera respuesta

    }

    async procesarMetodo(stepContext) {
    const respuesta = stepContext.result?.trim();

    switch (respuesta) {
        case '1':
            await stepContext.context.sendActivity('Elegiste subir un documento. Esperando archivo...');
            stepContext.options.metodo = 'documento';
            break;
        case '2':
            await stepContext.context.sendActivity('Elegiste llenar los campos manualmente.');
            stepContext.options.metodo = 'manual';
            break;
        case '3':
            await stepContext.context.sendActivity('Operación cancelada.');
            return await stepContext.cancelAllDialogs();
        default:
            await stepContext.context.sendActivity('❌ Opción no válida. Responde con un número entre 1 y 3.');
            return await stepContext.replaceDialog(this.id); // Corrige aquí
    }

    return await stepContext.next(stepContext.options); // Continúa con el siguiente paso del diálogo
}

    async preguntarCliente(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Preguntando por cliente");
        await stepContext.context.sendActivity('🧾 Vamos a comenzar. ¿Cuál es el nombre del *cliente*?');
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
    }

    async preguntarOrigen(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Cliente registrado:", stepContext.options.cliente);
        await stepContext.context.sendActivity('🌐 ¿Cuál es el *origen* de la solicitud?');
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
    }
    
    async preguntarUsuario(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Origen registrado:", stepContext.options.origen);
        await stepContext.context.sendActivity('👤 ¿Quién es el *usuario solicitante*?');
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
    }

    async preguntarTipoPerfil(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Usuario solicitante registrado:", stepContext.options.usuarioSolicitante);
        await stepContext.context.sendActivity('👔 ¿Cuál es el *tipo de perfil* que se está solicitando?');
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
    }

    async preguntarSkills(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Tipo de perfil registrado:", stepContext.options.tipoPerfil);
        await stepContext.context.sendActivity('🛠️ ¿Qué *skills* debe tener el candidato? (puedes separar por comas)');
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
    }

    async preguntarPrioridadStep(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Skills registradas:", stepContext.options.skills);
        await stepContext.context.sendActivity('⚠️ ¿Cuál es la *prioridad* de la solicitud? (Alta, Media, Baja)');
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
    }

    async preguntarValor(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Prioridad registrada:", stepContext.options.prioridad);
        await stepContext.context.sendActivity('💰 ¿Cuál es el *valor de la oportunidad*?');
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
    }

    async preguntarCiudadStep(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Valor de oportunidad registrado:", stepContext.options.valorOportunidad);
        await stepContext.context.sendActivity('📍 ¿En qué *ciudad* se requiere el candidato?');
        return await stepContext.prompt(TEXT_PROMPT, { prompt: '' });
    }

    async finalizarSolicitud(stepContext) {
        stepContext.options = stepContext.options || stepContext.result || {};
        console.log("🔄 Ciudad registrada:", stepContext.options.ciudad);
        
        // Crear resumen de la solicitud
        const solicitud = {
            metodo: stepContext.options.metodo,
            cliente: stepContext.options.cliente,
            origen: stepContext.options.origen,
            usuarioSolicitante: stepContext.options.usuarioSolicitante,
            tipoPerfil: stepContext.options.tipoPerfil,
            skills: stepContext.options.skills,
            prioridad: stepContext.options.prioridad,
            valorOportunidad: stepContext.options.valorOportunidad,
            ciudad: stepContext.options.ciudad
        };

        // Mostrar resumen
        const resumen = `
📋 **Solicitud Creada Exitosamente**

✅ **Cliente:** ${solicitud.cliente}
✅ **Origen:** ${solicitud.origen}
✅ **Usuario Solicitante:** ${solicitud.usuarioSolicitante}
✅ **Tipo de Perfil:** ${solicitud.tipoPerfil}
✅ **Skills:** ${solicitud.skills}
✅ **Prioridad:** ${solicitud.prioridad}
✅ **Valor de Oportunidad:** ${solicitud.valorOportunidad}
✅ **Ciudad:** ${solicitud.ciudad}

¡La solicitud ha sido registrada correctamente! 🎉
        `;

        await stepContext.context.sendActivity(resumen);
        
        // Aquí podrías guardar la solicitud en tu base de datos
        // await this.guardarSolicitud(solicitud);
        
        console.log("📋 Solicitud completada:", solicitud);
        return await stepContext.endDialog(solicitud);
    }
}

module.exports.SolicitudDialog = SolicitudDialog;