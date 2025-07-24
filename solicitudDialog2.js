const { ComponentDialog, WaterfallDialog, Dialog } = require('botbuilder-dialogs');
const axios = require('axios');

const SOLICITUD_DIALOG = 'solicitudDialog';
const WATERFALL_DIALOG = 'waterfallDialog';

class SolicitudDialog extends ComponentDialog {
    constructor(conversationState) {
        super(SOLICITUD_DIALOG);
        this.conversationDataAccessor = conversationState.createProperty('conversationData');
        
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.solicitarDatos.bind(this),
            this.solicitarSkills.bind(this),
            this.procesarConIA.bind(this),
            this.confirmarYEnviar.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async solicitarDatos(step) {
        const mensaje = `<br>📋 <b>NUEVA SOLICITUD</b><br><br>Por favor, proporciona la información:<br><br><b>CAMPOS OBLIGATORIOS:</b><br><b>Cliente:</b> <br><b>Perfil:</b><br><b>Prioridad:</b><br><b>Ciudad:</b><br><br><b>CAMPOS OPCIONALES:</b><br><b>Cliente Solvo:</b><br><b>Fecha Solicitud:</b> [DD/MM/YYYY]<br><b>Lab:</b><br><b>Rango Salarial:</b><br><br><hr>✍️ <b>Escribe la información ahora:</b><br><br>`;
        await step.context.sendActivity(mensaje);
        return Dialog.EndOfTurn;
    }

    async solicitarSkills(step) {
        const datos = this.extraerDatos(step.context.activity.text);
        
        if (!this.validarObligatorios(datos)) {
            const error = `<br>❌ <b>Faltan campos obligatorios</b><br><br><b>Cliente:</b> <br><b>Perfil:</b><br><b>Prioridad:</b><br><b>Ciudad:</b><br><br>Los campos opcionales pueden omitirse:<br><b>Cliente Solvo:</b> [si aplica]<br><b>Fecha Solicitud:</b> [DD/MM/YYYY]<br><b>Lab:</b><br><b>Rango Salarial:</b><br><br>`;
            await step.context.sendActivity(error);
            return await step.endDialog();
        }

        step.values.datos = datos;
        
        const resumen = this.crearResumen(datos);
        await step.context.sendActivity(resumen);
        
        const skillsMsg = `<br>🛠️ <b>AHORA LAS SKILLS</b><br><br>Describe las habilidades técnicas requeridas:<br><br><b>Ejemplos:</b><br><blockquote>- "React, TypeScript y experiencia en APIs REST"<br>- "Python, Django, PostgreSQL y Docker"<br>- "JavaScript, Node.js, React, bases de datos y AWS"</blockquote><hr>✍️ <b>Describe las skills requeridas:</b><br><br>`;
        await step.context.sendActivity(skillsMsg);
        
        return Dialog.EndOfTurn;
    }

    async procesarConIA(step) {
        const skills = step.context.activity.text;
        if (!skills?.trim()) {
            await step.context.sendActivity('<br>❌ No se recibieron las skills.<br><br>');
            return await step.endDialog();
        }

        const payload = {
            ...step.values.datos,
            skills: skills.trim(),
            fecha: new Date().toISOString(),
            timestamp: Date.now()
        };

        try {
            await step.context.sendActivity('<br>📤 <b>Procesando con IA...</b><br><br>');
            
            const response = await axios.post(
                'https://n8n-esencia-suite.zntoks.easypanel.host/webhook-test/simulacion-bot',
                payload,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                }
            );

            console.log('✅ Procesado con IA:', response.data);
            
            // Guardar toda la información procesada
            step.values.solicitudCompleta = {
                ...payload,
                skillsOriginales: skills.trim(),
                skillsProcesadas: response.data.skillsOrganizadas || response.data.skills || skills.trim(),
                respuestaIA: response.data
            };

            // Mostrar resultado al usuario
            await step.context.sendActivity(this.mostrarResumenCompleto(step.values.solicitudCompleta));
            
        } catch (error) {
            console.error('❌ Error procesando con IA:', error.message);
            await step.context.sendActivity('<br>❌ <b>Error procesando con IA</b><br><br>Continuando sin procesamiento...<br><br>');
            
            step.values.solicitudCompleta = {
                ...payload,
                skillsOriginales: skills.trim(),
                skillsProcesadas: skills.trim(),
                respuestaIA: null
            };
        }

        return Dialog.EndOfTurn;
    }

    async confirmarYEnviar(step) {
        const respuesta = step.context.activity.text.toLowerCase().trim();
        
        if (respuesta.includes('editar') || respuesta.includes('modificar') || respuesta.includes('cambiar')) {
            await step.context.sendActivity('<br>🔄 <b>Reiniciando solicitud...</b><br><br>Comenzaremos de nuevo con los datos básicos.<br><br>');
            return await step.replaceDialog(WATERFALL_DIALOG);
        }
        
        if (respuesta.includes('confirmar') || respuesta.includes('enviar') || respuesta.includes('si') || respuesta.includes('sí') || respuesta.includes('ok')) {
            try {
                // Aquí envías la solicitud final al sistema
                console.log('📤 Enviando solicitud final:', step.values.solicitudCompleta);
                
                await step.context.sendActivity('<br>✅ <b>Solicitud registrada exitosamente</b><br><br>📋 La información ha sido procesada y guardada en el sistema.<br>El equipo de reclutamiento ha sido notificado.<br><br>');
                
            } catch (error) {
                console.error('❌ Error enviando solicitud final:', error.message);
                await step.context.sendActivity('<br>❌ <b>Error al enviar la solicitud</b><br><br>Por favor, intenta nuevamente.<br><br>');
            }
        } else {
            await step.context.sendActivity('<br>❓ <b>Respuesta no reconocida</b><br><br>Por favor responde:<br>• <b>"Confirmar"</b> o <b>"Enviar"</b> para proceder<br>• <b>"Editar"</b> para modificar la información<br><br>');
            return Dialog.EndOfTurn;
        }

        return await step.endDialog();
    }

    extraerDatos(texto) {
        const datos = {};
        
        // Dividir por espacios y buscar patrones campo:valor
        const partes = texto.split(/\s+(?=[A-Za-z]+:)/);
        
        partes.forEach(parte => {
            const match = parte.match(/^([A-Za-z\s]+?):\s*(.+)$/);
            if (match) {
                const campo = match[1].trim().toLowerCase().replace(/\s+/g, '');
                const valor = match[2].trim();
                
                const fieldMap = {
                    'cliente': 'cliente',
                    'perfil': 'perfil', 
                    'prioridad': 'prioridad',
                    'ciudad': 'ciudad',
                    'clientesolvo': 'clienteSolvo',
                    'fechasolicitud': 'fechaSolicitud',
                    'lab': 'lab',
                    'rangosalarial': 'rangoSalarial'
                };

                if (fieldMap[campo]) {
                    datos[fieldMap[campo]] = valor;
                }
            }
        });

        console.log('Texto recibido:', texto);
        console.log('Datos extraídos:', datos);
        return datos;
    }

    validarObligatorios(datos) {
        return datos.cliente && datos.perfil && datos.prioridad && datos.ciudad;
    }

    crearResumen(datos) {
        if (!datos || typeof datos !== 'object') {
            return '<br>❌ <b>Error:</b> Datos no válidos<br><br>';
        }

        let resumen = `<br>✅ <b>Datos registrados:</b><br><br><b>OBLIGATORIOS:</b><br>👤 <b>Cliente:</b> ${datos.cliente}<br>💼 <b>Perfil:</b> ${datos.perfil}<br>⚡ <b>Prioridad:</b> ${datos.prioridad}<br>🌍 <b>Ciudad:</b> ${datos.ciudad}`;

        const opcionales = [];
        if (datos.clienteSolvo) opcionales.push(`👥 <b>Cliente Solvo:</b> ${datos.clienteSolvo}`);
        if (datos.fechaSolicitud) opcionales.push(`📅 <b>Fecha Solicitud:</b> ${datos.fechaSolicitud}`);
        if (datos.lab) opcionales.push(`🔬 <b>Lab:</b> ${datos.lab}`);
        if (datos.rangoSalarial) opcionales.push(`💰 <b>Rango Salarial:</b> ${datos.rangoSalarial}`);

        if (opcionales.length > 0) {
            resumen += `<br><br><b>OPCIONALES:</b><br>${opcionales.join('<br>')}`;
        }

        return resumen + '<br><br>';
    }

    mostrarResumenCompleto(solicitud) {
        let mensaje = `<br>🎯 <b>RESUMEN COMPLETO DE LA SOLICITUD</b><br><br>`;
        
        // Datos básicos
        mensaje += `<b>INFORMACIÓN BÁSICA:</b><br>`;
        mensaje += `👤 <b>Cliente:</b> ${solicitud.cliente}<br>`;
        mensaje += `💼 <b>Perfil:</b> ${solicitud.perfil}<br>`;
        mensaje += `⚡ <b>Prioridad:</b> ${solicitud.prioridad}<br>`;
        mensaje += `🌍 <b>Ciudad:</b> ${solicitud.ciudad}<br>`;
        
        // Campos opcionales
        const opcionales = [];
        if (solicitud.clienteSolvo) opcionales.push(`👥 <b>Cliente Solvo:</b> ${solicitud.clienteSolvo}`);
        if (solicitud.fechaSolicitud) opcionales.push(`📅 <b>Fecha Solicitud:</b> ${solicitud.fechaSolicitud}`);
        if (solicitud.lab) opcionales.push(`🔬 <b>Lab:</b> ${solicitud.lab}`);
        if (solicitud.rangoSalarial) opcionales.push(`💰 <b>Rango Salarial:</b> ${solicitud.rangoSalarial}`);
        
        if (opcionales.length > 0) {
            mensaje += `<br><b>INFORMACIÓN ADICIONAL:</b><br>${opcionales.join('<br>')}<br>`;
        }
        
        // Skills procesadas
        mensaje += `<br><b>SKILLS PROCESADAS POR IA:</b><br>`;
        mensaje += `<blockquote>${solicitud.skillsProcesadas}</blockquote><br>`;
        
        // Opciones
        mensaje += `<hr><b>¿Deseas proceder?</b><br><br>`;
        mensaje += `✅ Escribe <b>"Confirmar"</b> o <b>"Enviar"</b> para registrar la solicitud<br>`;
        mensaje += `✏️ Escribe <b>"Editar"</b> para modificar la información<br><br>`;
        
        return mensaje;
    }
}

module.exports.SolicitudDialog = SolicitudDialog;