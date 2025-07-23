const { ComponentDialog, WaterfallDialog, Dialog } = require('botbuilder-dialogs');
const axios = require('axios');

const SOLICITUD_DIALOG = 'solicitudDialog';
const WATERFALL_DIALOG = 'waterfallDialog';

class SolicitudDialog extends ComponentDialog {
    constructor(conversationState) {
        super(SOLICITUD_DIALOG);
        this.conversationDataAccessor = conversationState.createProperty('conversationData');
        
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.pedirDatos.bind(this),
            this.procesarSolicitud.bind(this),
            this.finalizarProceso.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    // 📝 PASO 1: Solicitar datos
    async pedirDatos(step) {
        const mensaje = `
📋 <b>NUEVA SOLICITUD</b>

Por favor, proporciona la siguiente información:

<b>CAMPOS OBLIGATORIOS:</b>
• <b>Cliente:</b> 
• <b>Usuario Solicita:</b> 
• <b>Origen:</b> [USA/COL]
• <b>Perfil:</b> 
• <b>Prioridad:</b> [Alta/Media/Baja]
• <b>Ciudad:</b> 
• <b>Skills:</b> 

<b>CAMPOS OPCIONALES:</b>
• <b>Salario:</b> 
• <b>Lab:</b> 

<b>Ejemplo:</b>
Cliente: TechCorp
Usuario Solicita: Juan Pérez  
Origen: COL
Perfil: Developer Full Stack
Prioridad: Alta
Ciudad: Bogotá
Skills: React, Node.js, PostgreSQL
Salario: $8M - $12M
        `;
        
        await step.context.sendActivity(mensaje);
        return Dialog.EndOfTurn;
    }

    // 🚀 PASO 2: Procesar con IA y mostrar resultado
    async procesarSolicitud(step) {
        const datos = this.extraerDatos(step.context.activity.text);
        
        // Auto-completar usuario si no se proporciona
        if (!datos.usuarioSolicita) {
            datos.usuarioSolicita = step.context.activity.from?.name || 'Usuario Bot';
        }

        // Validar campos obligatorios
        const errores = this.validarDatos(datos);
        if (errores.length > 0) {
            await step.context.sendActivity(`❌ <b>Faltan datos:</b>\n${errores.join('\n')}`);
            return await step.endDialog();
        }

        // Procesar con IA
        const solicitudProcesada = await this.procesarConIA(step, datos);
        step.values.solicitud = solicitudProcesada;

        // Mostrar resultado
        await step.context.sendActivity(this.generarResumen(solicitudProcesada));
        
        return Dialog.EndOfTurn;
    }

    // 📤 PASO 3: Enviar al Excel
    async finalizarProceso(step) {
    const solicitud = step.values.solicitud;

    try {
        await step.context.sendActivity('📤 Enviando al sistema...');
        
        console.log('🚀 Iniciando envío a Excel con:', solicitud);

        const response = await this.enviarAlExcel(solicitud);
        
        console.log('📨 Respuesta completa:', JSON.stringify(response, null, 2));
        
        if (response.success) {
            console.log('✅ Proceso exitoso');
            await step.context.sendActivity('✅ <b>¡Solicitud creada exitosamente!</b>\n\n📧 Equipo notificado\n🎉 Proceso completado');
            
            // Mostrar datos adicionales si están disponibles
            if (response.data && response.data.mensaje) {
                await step.context.sendActivity(`📋 Estado: ${response.data.mensaje}`);
            }
        } else {
            console.log('❌ Proceso falló:', response.message);
            throw new Error(response.message || 'Error desconocido');
        }

    } catch (error) {
        console.error('❌ Error al enviar:', error.message);
        console.error('❌ Stack completo:', error.stack);
        await step.context.sendActivity(`❌ Error al guardar la solicitud: ${error.message}`);
    }

    return await step.endDialog();
}


    // 🔍 Extraer datos del texto - SIMPLIFICADO Y FUNCIONAL
    extraerDatos(texto) {
        const datos = {};
        
        // Método simple: buscar cada campo individualmente
        const extracciones = [
            { key: 'cliente', pattern: 'Cliente:' },
            { key: 'usuarioSolicita', pattern: 'Usuario Solicita:' },
            { key: 'origen', pattern: 'Origen:' },
            { key: 'perfil', pattern: 'Perfil:' },
            { key: 'prioridad', pattern: 'Prioridad:' },
            { key: 'ciudad', pattern: 'Ciudad:' },
            { key: 'skills', pattern: 'Skills:' }
        ];

        for (let i = 0; i < extracciones.length; i++) {
            const actual = extracciones[i];
            const siguiente = extracciones[i + 1];
            
            const inicioIndex = texto.indexOf(actual.pattern);
            if (inicioIndex !== -1) {
                const inicioValor = inicioIndex + actual.pattern.length;
                let finValor;
                
                if (siguiente) {
                    // Buscar el siguiente campo
                    finValor = texto.indexOf(siguiente.pattern, inicioValor);
                    if (finValor === -1) finValor = texto.length;
                } else {
                    // Es el último campo (skills), tomar todo lo que resta
                    finValor = texto.length;
                }
                
                let valor = texto.substring(inicioValor, finValor).trim();
                
                // Para campos que no son skills, limpiar si es muy largo
                if (actual.key !== 'skills' && valor.length > 50) {
                    // Tomar solo hasta el primer espacio después de 30 caracteres
                    const espacioIndex = valor.indexOf(' ', 30);
                    if (espacioIndex > 0) {
                        valor = valor.substring(0, espacioIndex);
                    }
                }
                
                datos[actual.key] = valor;
            }
        }

        console.log('🔍 Datos extraídos:', datos);
        return datos;
    }



    // ✅ Validar datos obligatorios
    validarDatos(datos) {
        const obligatorios = {
            cliente: 'Cliente',
            usuarioSolicita: 'Usuario Solicita', 
            origen: 'Origen',
            perfil: 'Perfil',
            prioridad: 'Prioridad',
            ciudad: 'Ciudad',
            skills: 'Skills'
        };

        const errores = [];
        
        for (const [key, label] of Object.entries(obligatorios)) {
            if (!datos[key]) {
                errores.push(`• ${label}`);
            }
        }

        return errores;
    }

    async procesarConIA(step, datos) {
    try {
        await step.context.sendActivity('🤖 Analizando con IA...\n⏳ Procesando...');

        const response = await axios.post(
            'https://n8n-esencia-suite.zntoks.easypanel.host/webhook-test/simulacion-bot',
            datos,
            { 
                headers: { 'Content-Type': 'application/json' },
                timeout: 45000
            }
        );

        console.log('✅ Respuesta completa de n8n:', JSON.stringify(response.data, null, 2));

        return {
            ...datos,
            skillsOriginales: datos.skills,
            skillsIA: response.data?.skillsOrganizadas || response.data?.skills || datos.skills,
            procesamientoExitoso: true,
            respuestaN8N: response.data // ✅ GUARDAR TODA LA RESPUESTA AQUÍ
        };

    } catch (error) {
        console.error('❌ Error IA:', error.message);
        
        await step.context.sendActivity('⚠️ IA no disponible, continuando...');
        
        return {
            ...datos,
            skillsOriginales: datos.skills,
            skillsIA: datos.skills,
            procesamientoExitoso: false,
            errorIA: error.message
        };
    }
}


            // 📋 Generar resumen final - VERSIÓN CORREGIDA
generarResumen(solicitud) {
    let mensaje = `
<b>📋 SOLICITUD PROCESADA</b>

<b>INFORMACIÓN BÁSICA:</b>
👤 Cliente: ${solicitud.cliente}
👨‍💼 Solicitante: ${solicitud.usuarioSolicita}
🌐 Origen: ${solicitud.origen}
💼 Perfil: ${solicitud.perfil}  
⚡ Prioridad: ${solicitud.prioridad}
🌍 Ciudad: ${solicitud.ciudad}
    `;

    // Campos opcionales
    if (solicitud.salario) mensaje += `\n💰 Salario: ${solicitud.salario}`;
    if (solicitud.lab) mensaje += `\n🔬 Lab: ${solicitud.lab}`;

    // ✅ USAR DATOS ORGANIZADOS DE N8N
    if (solicitud.procesamientoExitoso && solicitud.respuestaN8N?.mensaje) {
        const mensajeLimpio = solicitud.respuestaN8N.mensaje;
        
        // Extraer secciones organizadas
        const responsabilidadesMatch = mensajeLimpio.match(/🧰 Responsabilidades \(\d+\):(.*?)(?=📌|💻|🎯|💾|$)/s);
        const requisitosMatch = mensajeLimpio.match(/📌 Requisitos \(\d+\):(.*?)(?=💻|🎯|💾|$)/s);
        const tecnologiasMatch = mensajeLimpio.match(/💻 Tecnologías \(\d+\):(.*?)(?=🎯|💾|$)/s);
        
        mensaje += `\n\n<b>🤖 ANÁLISIS POR IA:</b>`;
        
        if (responsabilidadesMatch) {
            mensaje += `\n\n<b>🧰 RESPONSABILIDADES:</b>${responsabilidadesMatch[1].trim()}`;
        }
        
        if (requisitosMatch) {
            mensaje += `\n\n<b>📌 REQUISITOS:</b>${requisitosMatch[1].trim()}`;
        }
        
        if (tecnologiasMatch) {
            mensaje += `\n\n<b>💻 TECNOLOGÍAS:</b>${tecnologiasMatch[1].trim()}`;
        }
        
    } else {
        // Fallback simple
        mensaje += `\n\n<b>💻 SKILLS:</b>\n${solicitud.skills}`;
    }

    return mensaje;
}

}

module.exports.SolicitudDialog = SolicitudDialog;