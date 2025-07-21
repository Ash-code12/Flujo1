const axios = require('axios');
const pdf = require('pdf-parse');

class AzureAIPDFProcessor {
    constructor() {
        // Configuración de Azure OpenAI
        this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || 'https://tu-recurso.openai.azure.com';
        this.azureApiKey = process.env.AZURE_OPENAI_API_KEY || 'tu-api-key-aqui';
        this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-35-turbo';
        this.apiVersion = '2023-12-01-preview';
        
        // Prompt para la IA
        this.systemPrompt = `
        Eres un asistente especializado en extraer información de solicitudes de reclutamiento.
        
        Extrae la siguiente información del texto y devuélvela en formato JSON válido:
        
        {
            "cliente": "nombre del cliente",
            "origen": "origen de la solicitud",
            "usuarioSolicitante": "usuario que solicita",
            "tipoPerfil": "tipo de perfil solicitado",
            "skills": "habilidades requeridas separadas por comas",
            "prioridad": "Alta/Media/Baja",
            "valorOportunidad": "valor económico",
            "ciudad": "ciudad donde se requiere"
        }
        
        Reglas:
        - Si no encuentras algún campo, ponlo como null
        - La prioridad debe ser exactamente: "Alta", "Media" o "Baja"
        - Las skills deben estar separadas por comas
        - Responde SOLO con el JSON, sin texto adicional
        `;
    }

    /**
     * Procesa un archivo PDF usando Azure OpenAI
     * @param {Object} attachment - Archivo adjunto del bot framework
     * @returns {Object} Datos extraídos del PDF
     */
    async procesarPDF(attachment) {
        try {
            console.log('🤖 Iniciando procesamiento de PDF con Azure OpenAI:', attachment.name);
            
            // Descargar el archivo PDF
            const pdfBuffer = await this.descargarArchivo(attachment.contentUrl);
            
            // Extraer texto del PDF
            const textoExtraido = await this.extraerTexto(pdfBuffer);
            
            // Procesar con Azure OpenAI
            const datosExtraidos = await this.procesarConAzureOpenAI(textoExtraido);
            
            console.log('✅ PDF procesado exitosamente con Azure OpenAI');
            return datosExtraidos;
            
        } catch (error) {
            console.error('❌ Error procesando PDF con Azure OpenAI:', error);
            throw new Error(`Error al procesar el PDF: ${error.message}`);
        }
    }

    /**
     * Descarga el archivo PDF desde la URL
     * @param {string} url - URL del archivo
     * @returns {Buffer} Buffer del archivo PDF
     */
    async descargarArchivo(url) {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer'
            });
            
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Error descargando archivo: ${error.message}`);
        }
    }

    /**
     * Extrae texto del PDF usando pdf-parse
     * @param {Buffer} pdfBuffer - Buffer del archivo PDF
     * @returns {string} Texto extraído del PDF
     */
    async extraerTexto(pdfBuffer) {
        try {
            const data = await pdf(pdfBuffer);
            
            if (!data.text || data.text.trim().length === 0) {
                throw new Error('No se pudo extraer texto del PDF');
            }
            
            console.log('📄 Texto extraído del PDF (primeros 200 caracteres):', 
                       data.text.substring(0, 200) + '...');
            
            return data.text;
        } catch (error) {
            throw new Error(`Error extrayendo texto del PDF: ${error.message}`);
        }
    }

    /**
     * Procesa el texto extraído usando Azure OpenAI
     * @param {string} texto - Texto extraído del PDF
     * @returns {Object} Datos estructurados extraídos por la IA
     */
    async procesarConAzureOpenAI(texto) {
        try {
            console.log('🤖 Enviando texto a Azure OpenAI para procesamiento...');
            
            const url = `${this.azureEndpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
            
            const response = await axios.post(url, {
                messages: [
                    {
                        role: "system",
                        content: this.systemPrompt
                    },
                    {
                        role: "user",
                        content: `Extrae la información de esta solicitud de reclutamiento:\n\n${texto}`
                    }
                ],
                max_tokens: 1000,
                temperature: 0.1,
                top_p: 1.0,
                frequency_penalty: 0,
                presence_penalty: 0
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.azureApiKey
                }
            });

            const respuestaIA = response.data.choices[0].message.content.trim();
            console.log('🤖 Respuesta de Azure OpenAI:', respuestaIA);

            // Parsear la respuesta JSON
            const datosExtraidos = JSON.parse(respuestaIA);
            
            // Validar y limpiar los datos
            return this.validarDatos(datosExtraidos);

        } catch (error) {
            console.error('❌ Error procesando con Azure OpenAI:', error);
            throw new Error(`Error procesando con Azure OpenAI: ${error.message}`);
        }
    }

    /**
     * Valida y limpia los datos extraídos por la IA
     * @param {Object} datos - Datos extraídos por la IA
     * @returns {Object} Datos validados y limpiados
     */
    validarDatos(datos) {
        const datosLimpios = {};
        
        // Mapear y validar cada campo
        const camposEsperados = [
            'cliente', 'origen', 'usuarioSolicitante', 
            'tipoPerfil', 'skills', 'prioridad', 
            'valorOportunidad', 'ciudad'
        ];
        
        for (const campo of camposEsperados) {
            if (datos[campo] && datos[campo] !== null && datos[campo] !== 'null') {
                datosLimpios[campo] = this.limpiarCampo(campo, datos[campo]);
            }
        }
        
        console.log('✅ Datos validados:', datosLimpios);
        return datosLimpios;
    }

    /**
     * Limpia un campo específico según su tipo
     * @param {string} campo - Nombre del campo
     * @param {string} valor - Valor del campo
     * @returns {string} Valor limpiado
     */
    limpiarCampo(campo, valor) {
        if (typeof valor !== 'string') {
            valor = String(valor);
        }
        
        switch (campo) {
            case 'prioridad':
                const prioridadLower = valor.toLowerCase();
                if (prioridadLower.includes('alta') || prioridadLower.includes('high')) {
                    return 'Alta';
                } else if (prioridadLower.includes('media') || prioridadLower.includes('medium')) {
                    return 'Media';
                } else if (prioridadLower.includes('baja') || prioridadLower.includes('low')) {
                    return 'Baja';
                }
                return valor;
                
            case 'skills':
                return valor
                    .replace(/[;|]/g, ',')
                    .replace(/,+/g, ',')
                    .replace(/^,|,$/g, '')
                    .trim();
                    
            case 'valorOportunidad':
                return valor.trim();
                
            default:
                return valor.trim();
        }
    }

    /**
     * Método para testing - simula la extracción de datos
     * @returns {Object} Datos de prueba
     */
    obtenerDatosPrueba() {
        return {
            cliente: 'Empresa ABC',
            origen: 'Portal Web',
            usuarioSolicitante: 'Juan Pérez',
            tipoPerfil: 'Desarrollador Full Stack',
            skills: 'JavaScript, React, Node.js, MongoDB',
            prioridad: 'Alta',
            valorOportunidad: '$5,000 USD',
            ciudad: 'Bogotá'
        };
    }
}

module.exports = AzureAIPDFProcessor;