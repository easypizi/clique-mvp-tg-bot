import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import UserController from "./controllers/userController.js";
import BotHelper from "./helpers/BotHelpers.js";
import UserService from "./services/UserService.js";

dotenv.config();

const token = process.env.TG_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const WEB_APP_URL = process.env.WEB_APP_URL;
const API_URL = process.env.API_URL;

bot.on("polling_error", (error) => {
  console.log(error.code); // => 'EFATAL'
});

// OPEN APP
bot.onText(/\/open_app/, async (msg) => {
  const chatId = msg.chat.id;
  const isPrivate = msg?.chat?.type === "private";
  try {
    if (isPrivate) {
      await bot.sendMessage(chatId, "Click below to open the app: ", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Open app",
                web_app: { url: `${WEB_APP_URL}` },
              },
            ],
          ],
        },
      });
    } else {
      // NEED TO THINK ABOUT BEHAVIOR INSIDE THE GROUP.
      // PROBABLY WE NEED SOME KIND OF AUTHORIZATION.
      // CHECK ACCESS BY BOT DATA
      await bot
        .sendMessage(chatId, "We are welcome you! Click on the link below: ", {
          reply_markup: {
            inline_keyboard: [[{ text: "Open app", url: `${WEB_APP_URL}` }]],
          },
        })
        .then((sentMsg) => {
          setTimeout(() => {
            bot.deleteMessage(chatId, sentMsg.message_id);
          }, 3000);
        });
    }
  } catch (error) {
    console.log(error);
  }
});

//Add yourself to TWA
bot.onText(/\/add/, async (msg) => {
  const isPrivate = msg?.chat?.type === "private";
  const commandMsgId = msg.message_id;
  const chatId = msg.chat.id;
  await BotHelper.deleteMessage(bot, chatId, commandMsgId, 500);

  if (isPrivate) {
    await BotHelper.sendDelete(
      bot,
      chatId,
      "If you want register yourself inside any community, please register yourself – throw the command /add in the chat of that community.",
      5000
    );

    setTimeout(() => {
      bot.deleteMessage(chatId, msg.message_id);
    }, 500);

    return;
  }

  const userId = msg.from.id;
  const userData = await UserService.getUserData(bot, chatId, userId);
  const userPhoto = await UserService.getUserProfilePhotos(
    bot,
    userId,
    chatId,
    token
  );
  const groupAdmins = await UserService.getAdministrators(bot, chatId);
  const preparedData = await UserService.formatData(
    userData,
    userPhoto,
    groupAdmins
  );

  await UserController.addNewUser(bot, API_URL, preparedData, chatId);
});

bot.on("new_chat_members", async (msg) => {
  const chatId = msg.chat.id;
  const newMembers = msg.new_chat_members;

  newMembers.forEach(async (member) => {
    if (member.is_bot) {
      return;
    }

    const userId = member.id;
    const userData = await UserService.getUserData(bot, chatId, userId);
    const userPhoto = await UserService.getUserProfilePhotos(
      bot,
      userId,
      chatId,
      token
    );
    const groupAdmins = await UserService.getAdministrators(bot, chatId);
    const preparedData = await UserService.formatData(
      userData,
      userPhoto,
      groupAdmins
    );

    await UserController.addNewUser(bot, API_URL, preparedData, chatId);
  });
});
