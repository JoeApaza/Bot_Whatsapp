const { createProvider, createFlow,addKeyword } = require("@bot-whatsapp/bot");
const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");
const GeminiBot = require("./Services/GeminiClass");

const flowSaludar=addKeyword('hola', 'ole', 'alo','Joe','Mano')
    .addAnswer("Hola que tal, soy la IA de *Recuperacion Clientes Corporativos*.",{
        delay:1000,
        media:"https://img.freepik.com/vector-premium/ilustracion-dibujos-animados-lindo-robot-agitando-mano_138676-2744.jpg?size=338&ext=jpg&ga=GA1.1.1687694167.1713398400&semt=sph"

    },
        async(ctx,ctxFn)=>{
            console.log(ctx.body)
            await ctxFn.flowDynamic("Por favor puedes escribir cualquier duda o enviar un audio con tu pregunta")

    })


const createGemini = async ({ provider, database }) => {
  return new GeminiBot(database, provider);
};

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterFlow = createFlow([flowSaludar]);
  const adapterProvider = createProvider(BaileysProvider, {
    usePairingCode: true,
    phoneNumber: "Tu numero",
  });


  await createGemini({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });
};

main();
