const { MessageFactory } = require('botbuilder');
const { ComponentDialog, WaterfallDialog, Dialog } = require('botbuilder-dialogs');
const axios = require('axios');

const SOLICITUD_DIALOG = 'solicitudDialog';
const WATERFALL_DIALOG = 'waterfallDialog';

class SolicitudDialog extends ComponentDialog {
    constructor(conversationState) {
        super(SOLICITUD_DIALOG);
        this.conversationDataAccessor = conversationState.createProperty('conversationData');
        
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.solicitarDatosBasicos.bind(this),
            this.solicitarSkills.bind(this),
            this.procesarSolicitud.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async solicitarDatosBasicos(step) {
        await step.context.sendActivity(this.getMensajeDatosBasicos());
        return Dialog.EndOfTurn; //termina el paso y espera respuesta
    }

    async solicitarSkills(step) {
        const datosBasicos = this.extraerDatosBasicos(step.context.activity.text);
        
        if (!this.validarDatosBasicos(datosBasicos)) {
            await step.context.sendActivity(this.getMensajeFormatoIncorrecto());
            return await step.endDialog();
        }

        step.values.solicitudBasica = datosBasicos; //Guarda los datos
        
        await step.context.sendActivity(this.getResumenDatosBasicos(datosBasicos));
        await step.context.sendActivity(this.getMensajeSkills());
        
        return Dialog.EndOfTurn;
    }

    async procesarSolicitud(step) {
        const skillsTexto = step.context.activity.text;
        if (!skillsTexto) {
            await step.context.sendActivity('❌ No se recibieron las skills.');
            return await step.endDialog();
        }

        const solicitudCompleta = {
            ...step.values.solicitudBasica,  //copia todos los datos del paso anterior
            skillsOriginales: skillsTexto,
            fecha: new Date().toLocaleString('es-CO')
        };

        await step.context.sendActivity('Procesando skills con IA...');

        try {
            const skillsProcesadas = await this.procesarConIA(solicitudCompleta);
            solicitudCompleta.skillsProcesadas = skillsProcesadas;
            await step.context.sendActivity(this.getMensajeExito(solicitudCompleta, skillsProcesadas));
        } catch (error) {
            console.error('❌ Error procesando con IA:', error);
            await step.context.sendActivity(this.getMensajeExitoSinIA(solicitudCompleta));
        }

        return await step.endDialog(solicitudCompleta);
    }

    // Métodos de validación y extracción
    extraerDatosBasicos(texto) {
        const patrones = {
            // Campos obligatorios
            cliente: /cliente:\s*(.+)/i,  //cero o más espacios, (.+) todo lo que viene después, /i insensible a mayús y minús
            perfil: /perfil:\s*(.+)/i,
            prioridad: /prioridad:\s*(.+)/i,
            ciudad: /ciudad:\s*(.+)/i,
            // Campos opcionales
            clienteSolvo: /cliente\s+solvo:\s*(.+)/i,
            fechaSolicitud: /fecha\s+solicitud:\s*(.+)/i,
            lab: /lab:\s*(.+)/i,
            rangoSalarial: /rango\s+salarial:\s*(.+)/i
        };

//Procesar patrones 
        return Object.fromEntries(  //Convierte array de vuelta a objeto
            Object.entries(patrones)  //Convierte objeto en array
                .map(([campo, patron]) => { //Transforma cada patrón
                    const match = texto?.match(patron);   //Busca patrón en el texto ? por si es null
                    return [campo, match ? match[1].trim() : ''];  //(Match) primer grupo del regex, quita espacios inicio y final, devuelve string vacio si no encuentra nada
                })
        );
    }

    validarDatosBasicos(datos) {  //Valida que los 4 campos tengan valor
        return datos.cliente && datos.perfil && datos.prioridad && datos.ciudad;
    }

    // Métodos de mensajes
    getMensajeDatosBasicos() {
        return `📋 **REGISTRO DE SOLICITUD**

Por favor, proporciona la información. Los campos marcados con (*) son obligatorios:

**CAMPOS OBLIGATORIOS:**
**Cliente:*** [Nombre del cliente]
**Perfil:*** [Frontend/Backend/FullStack/DevOps/QA]
**Prioridad:*** [Alta/Media/Baja]
**Ciudad:*** [Ubicación o Remoto]

**CAMPOS OPCIONALES:**
**Cliente Solvo:** [Si aplica]
**Fecha Solicitud:** [DD/MM/YYYY]
**Lab:** [Laboratorio/Área]
**Rango Salarial:** [Ejemplo: $2-3M]

**Ejemplo:**
Cliente: Empresa XYZ
Perfil: Frontend
Prioridad: Alta
Ciudad: Bogotá
Rango Salarial: $2.5-3M

---
✍️ **Escribe la información ahora:**`;
    }

    getMensajeFormatoIncorrecto() {
        return `❌ **Faltan campos obligatorios** 

Los campos marcados con (*) son obligatorios:
Cliente: [nombre] *
Perfil: [tipo] *
Prioridad: [nivel] *
Ciudad: [ubicación] *

Los campos opcionales pueden omitirse:
Cliente Solvo: [si aplica]
Fecha Solicitud: [DD/MM/YYYY]
Lab: [área]
Rango Salarial: [ejemplo: $2-3M]`;
    }

    getResumenDatosBasicos(datos) {
        let resumen = `✅ **Datos registrados:**

**OBLIGATORIOS:**
👤 **Cliente:** ${datos.cliente}
💼 **Perfil:** ${datos.perfil}
⚡ **Prioridad:** ${datos.prioridad}
🌍 **Ciudad:** ${datos.ciudad}`;

        // Agregar campos opcionales solo si tienen valor
        const opcionales = [];
        if (datos.clienteSolvo) opcionales.push(`👥 **Cliente Solvo:** ${datos.clienteSolvo}`);
        if (datos.fechaSolicitud) opcionales.push(`📅 **Fecha Solicitud:** ${datos.fechaSolicitud}`);
        if (datos.lab) opcionales.push(`🔬 **Lab:** ${datos.lab}`);
        if (datos.rangoSalarial) opcionales.push(`💰 **Rango Salarial:** ${datos.rangoSalarial}`);

        if (opcionales.length > 0) {
            resumen += `\n\n**OPCIONALES:**\n${opcionales.join('\n')}`;
        }

        return resumen;
    }

    getMensajeSkills() {
        return `🛠️ **AHORA LAS SKILLS**

Describe las habilidades técnicas requeridas:

**Ejemplos:**
- "React, TypeScript y experiencia en APIs REST"
- "Python, Django, PostgreSQL y Docker"
- "JavaScript, Node.js, React, bases de datos y AWS"

---
✍️ **Describe las skills requeridas:**`;
    }

    getMensajeExito(solicitud, skillsProcesadas) {
        return `✅ **Solicitud registrada exitosamente**

📋 **RESUMEN COMPLETO:**
👤 **Cliente:** ${solicitud.cliente}
💼 **Perfil:** ${solicitud.perfil}
⚡ **Prioridad:** ${solicitud.prioridad}
🌍 **Ciudad:** ${solicitud.ciudad}
📅 **Fecha:** ${solicitud.fecha}

🛠️ **Skills organizadas:**
${skillsProcesadas}

La solicitud ha sido enviada al equipo de reclutamiento.`;
    }

    getMensajeExitoSinIA(solicitud) {
        return `✅ **Solicitud registrada** (Sin procesamiento IA)

📋 **RESUMEN:**
👤 **Cliente:** ${solicitud.cliente}
💼 **Perfil:** ${solicitud.perfil}
⚡ **Prioridad:** ${solicitud.prioridad}
🌍 **Ciudad:** ${solicitud.ciudad}
🛠️ **Skills:** ${solicitud.skillsOriginales}

⚠️ Las skills no pudieron procesarse con IA, pero la solicitud fue registrada.`;
    }

    // Procesamiento con IA
    async procesarConIA(solicitud) {
        const N8N_WEBHOOK_URL = 'https://tu-n8n-instance.com/webhook/organizar-perfil';
        
        const payload = {
            // Campos obligatorios
            cliente: solicitud.cliente,
            perfil: solicitud.perfil,
            prioridad: solicitud.prioridad,
            ciudad: solicitud.ciudad,
            skillsOriginales: solicitud.skillsOriginales,
            fecha: solicitud.fecha,
            // Campos opcionales (vacíos si no se proporcionan)
            clienteSolvo: solicitud.clienteSolvo || '',
            fechaSolicitud: solicitud.fechaSolicitud || '',
            lab: solicitud.lab || '',
            rangoSalarial: solicitud.rangoSalarial || ''
        };

        console.log('📤 Enviando a n8n:', payload);

        const response = await axios.post(N8N_WEBHOOK_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        console.log('📥 Respuesta de n8n:', response.data);
        return response.data.skillsOrganizadas || response.data.skills || solicitud.skillsOriginales;
    }
}

module.exports.SolicitudDialog = SolicitudDialog;