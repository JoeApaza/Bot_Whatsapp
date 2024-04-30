const { GoogleGenerativeAI } = require("@google/generative-ai");
const { CoreClass } = require("@bot-whatsapp/bot");
const Queue = require("queue-promise");
require("dotenv").config();

/**
 * Clase que representa al bot Gemini.
 * Extiende de la clase CoreClass.
 */
/**
 * Clase que representa al bot Gemini.
 * @class
 * @extends CoreClass
 */
class GeminiBot extends CoreClass {
  static queue = new Queue({
    concurrent: 1,
    interval: 100,
  });

  /**
   * Constructor de la clase GeminiBot.
   * @param {object} database - Base de datos utilizada por el bot.
   * @param {object} messageProvider - Proveedor de mensajes utilizado por el bot.
   */
  constructor(database, messageProvider) {
    super(null, database, messageProvider);
    this.validateInitialization(database, messageProvider);
    this.messageProvider = messageProvider;
    this.userContexts = {};
    this.initializeAI();
  }

  /**
   * Valida los parámetros de inicialización del bot.
   * @param {object} database - Base de datos utilizada por el bot.
   * @param {object} messageProvider - Proveedor de mensajes utilizado por el bot.
   * @throws {Error} - Si no se proporciona la base de datos o el proveedor de mensajes.
   */
  validateInitialization(database, messageProvider) {
    console.log("Validando parámetros de inicialización...");
    if (!database || !messageProvider) {
      throw new Error("Se requieren base de datos y proveedor de mensajes.");
    }
  }

  /**
   * Inicializa la inteligencia artificial del bot.
   * @throws {Error} - Si falla la inicialización de la inteligencia artificial.
   */
  async initializeAI() {
    try {
      this.genAI = new GoogleGenerativeAI(process.env.API_KEY);
      console.log("GeminiBot está listo!");
    } catch (error) {
      console.error("Falló la inicialización de GeminiBot:", error);
      throw new Error(`Falló la inicialización de GeminiBot: ${error}`);
    }
  }

  /**
   * Maneja un mensaje recibido por el bot.
   * @param {object} ctx - Contexto del mensaje.
   */
  handleMsg = async (ctx) => {
    console.log("Manejando mensaje de:", ctx.from);
    const { body: messageBody, from: senderId } = ctx;

    if (this.isUnsupportedMessageType(messageBody)) {
      console.log("Tipo de mensaje no soportado recibido:", messageBody);
      await this.sendUnsupportedMessageNotice(senderId);
      return;
    }

    this.updateUserContext(senderId, messageBody, "user");

    GeminiBot.queue.enqueue(async () => {
      const response = await this.generateAIResponse(messageBody, senderId);

      this.updateUserContext(senderId, response, "ia");

      await this.sendResponse(senderId, response);
    });
  };

  /**
   * Verifica si un tipo de mensaje no es soportado por el bot.
   * @param {string} messageBody - Cuerpo del mensaje.
   * @returns {boolean} - true si el tipo de mensaje no es soportado, false en caso contrario.
   */
  isUnsupportedMessageType(messageBody) {
    return /^_event_(media|document|voice_note)_/.test(messageBody);
  }

  /**
   * Envía un aviso de mensaje no soportado al remitente.
   * @param {string} senderId - ID del remitente.
   */
  async sendUnsupportedMessageNotice(senderId) {
    const message = "Lo siento, no puedo procesar este tipo de mensaje.";
    console.log("Enviando aviso de mensaje no soportado a:", senderId);
    await this.messageProvider.sendText(`${senderId}@s.whatsapp.net`, message);
  }

  async generateAIResponse(messageBody, senderId) {
    const previousContext = this.getContextForUser(senderId);
    const lastUserResponse =
      previousContext?.lastUserEntry?.content ||
      `Aun no hay preguntas del usuario con ID: ${senderId}`;
    const lastIaResponse =
      previousContext?.lastIaEntry?.content ||
      `Aun no hay respuestas anteriores de la IA para el usuario con ID ${senderId}, si no lo hay debería ser un saludo o mensaje de bienvenida, debes: Analizar y Comprender la Intención: Evalúa cuidadosamente el mensaje actual del usuario para identificar su intención principal. Debes considerar tanto el contenido explícito del mensaje como cualquier contexto implícito o subtexto basado en vuestras interacciones previas. Proporcionar Respuestas Relevantes y Proactivas: Utiliza tu acceso a un amplio espectro de información y conocimientos para formular una respuesta que sea directamente relevante para la consulta o comentario del usuario. Además, anticipa posibles preguntas de seguimiento o necesidades relacionadas, ofreciendo respuestas que van más allá de la pregunta inmediata para abordar lo que el usuario podría necesitar a continuación. Personalizar la Comunicación: Asegúrate de que tu respuesta sea informativa, útil y especialmente adaptada al usuario, teniendo en cuenta su historial de interacciones. La comunicación debe ser clara y coherente, y, cuando sea posible, debe ser alentadora o motivadora, mostrando empatía y comprensión hacia el usuario. Recuerda, tu papel es actuar como un asistente virtual inteligente cuya función principal es ayudar al usuario a explorar temas, resolver dudas, o asistir en tareas específicas. Debes ser un recurso valioso y confiable para el usuario, capaz de ofrecer asistencia detallada y personalizada desde el momento en que el usuario se pone en contacto contigo. Quiero que si es posibles que me des una respuesta más clara y precisa, por favor y que decores con emojis, si es posible. Gracias.`;

    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: `La última pregunta del usuario con ID: ${senderId} fue: "${lastUserResponse}`,
        },
        {
          role: "model",
          parts: `Tu última respuestade la IA para el ID: ${senderId} fue: "${lastIaResponse}`,
        },
      ],
    });

    console.log(
      "Visualizando el chat:",
      chat?._history?.map((h) => h.parts)
    );

    const result = await chat.sendMessage(messageBody);
    const response = await result.response;
    const text = response.text();
    return text;
  }

  /**
   * Actualiza el contexto del usuario con el mensaje recibido.
   * @param {string} senderId - ID del remitente.
   * @param {string} content - Contenido del mensaje.
   * @param {string} type - Tipo de mensaje ("user" o "ia").
   */
  async updateUserContext(senderId, content, type) {
    if (!this.userContexts[senderId]) {
      this.userContexts[senderId] = [];
    }

    const contextEntry = {
      type,
      content,
      timestamp: new Date().toLocaleString(),
    };

    this.userContexts[senderId].push(contextEntry);

    while (this.userContexts[senderId].length > 5) {
      this.userContexts[senderId].shift(); // Eliminar el mensaje más antiguo
    }
  }

  /**
   * Obtiene el contexto del usuario.
   * @param {string} senderId - ID del remitente.
   * @returns {object|null} - Contexto del usuario.
   */
  getContextForUser(senderId) {
    if (
      !this.userContexts[senderId] ||
      this.userContexts[senderId].length === 0
    ) {
      return null;
    }

    const contextEntries = this.userContexts[senderId];
    const lastUserEntry = contextEntries.filter((e) => e.type === "user").pop();
    const lastIaEntry = contextEntries.filter((e) => e.type === "ia").pop();

    if (!lastUserEntry || !lastIaEntry) {
      return null;
    }

    return {
      lastIaEntry,
      lastUserEntry,
    };
  }

  /**
   * Envía una respuesta al remitente.
   * @param {string} senderId - ID del remitente.
   * @param {string} response - Respuesta a enviar.
   */
  async sendResponse(senderId, response) {
    console.log("Enviando respuesta a:", senderId, "Respuesta:", response);
    await this.messageProvider.sendText(`${senderId}@s.whatsapp.net`, response);
  }
}

module.exports = GeminiBot;
