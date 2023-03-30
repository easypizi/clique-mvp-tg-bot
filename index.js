import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";

import UserController from "./src/controllers/UserController.js";
import BotHelper from "./src/helpers/BotHelper.js";
import UserService from "./src/services/UserService.js";
import StoreService from "./src/store/StoreService.js";

dotenv.config();

const token = process.env.TG_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL;
const API_URL = process.env.API_URL;

const BOT_COMMANDS = {
  ADD_USER: "/add",
  SPACE: "/space",
  OPEN_APP: "/open_app",
};

const BOT_STATE_MANAGER_MAPPING = {
  CREATE_SPACE_INIT: "create_space_init",
  CREATE_SPACE_EDIT_NAME: "create_space_name",
  CREATE_SPACE_EDIT_DESCRIPTION: "create_space_description",
  EDIT_SPACE_NAME: "edit_space_name",
  EDIT_SPACE_DESCRIPTION: "edit_space_description",
  DEFAULT: null,
};

let bot;

//BOT CONFIG
if (process.env.NODE_ENV === "production") {
  //SERVER FOR WEB HOOK
  const app = express();
  app.use(bodyParser.json());
  bot = new TelegramBot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
  let server = app.listen(process.env.PORT, "0.0.0.0", () => {
    const host = server.address().address;
    const port = server.address().port;
    console.log("Web server started at http://%s:%s", host, port);
  });
  app.post("/" + bot.token, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  console.log("Bot server started in the " + process.env.NODE_ENV + " mode");
} else {
  bot = new TelegramBot(token, { polling: true });
}

//POLLING ERRORS DETECTION;
bot.on("polling_error", (error) => {
  console.log(error.code); // => 'EFATAL'
});

//WEBHOOK ERRORS DETECTION:
bot.on("webhook_error", (error) => {
  console.log(error.code); // => 'EPARSE'
});

// CREATE SPACE
bot.onText(/\/space/, async (msg) => {
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const commandMsgId = await BotHelper.getMsgId(msg);
  const isPrivate = await BotHelper.isChatPrivate(msg);

  //STORE METHODS
  await StoreService.updateCurrentState(
    chatId,
    BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_INIT
  );
  await StoreService.updateLastCommand(chatId, BOT_COMMANDS.CREATE_SPACE);

  // CHECK THAT THIS ACTION DOESN'T CALLED INSIDE CHAT
  if (!isPrivate) {
    await BotHelper.deleteMessage(bot, chatId, isPrivate, commandMsgId, 500);
    await BotHelper.sendDelete(
      bot,
      chatId,
      "If you want create new space for community, please send this command to this bot in private messages",
      1000
    );
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    return;
  }

  const { community_data } = await StoreService.getStoreState(chatId);

  if (!community_data.id) {
    await BotHelper.send(
      bot,
      chatId,
      `Looks like you are not managing any community. Please follow instructions to create one.\n\nProvide community name: `
    );
  } else {
    const { community_data } = await StoreService.getStoreState(chatId);
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "Edit",
            callback_data: "edit_community_data",
          },
          {
            text: "Delete",
            callback_data: "delete_community",
          },
        ],
      ],
    };
    await BotHelper.send(
      bot,
      chatId,
      `You already managing ${community_data.name} community. Do you want to edit it or delete?`,
      {
        reply_markup: inlineKeyboard,
      }
    );
  }
});
// OPEN APP
bot.onText(/\/open_app/, async (msg) => {
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const commandMsgId = await BotHelper.getMsgId(msg);
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const userId = await BotHelper.getUserIdByMessage(msg);

  const { currentState: isProcessing, last_command: lastCommand } =
    await StoreService.getStoreState(chatId);

  if (isProcessing) {
    await BotHelper.send(
      bot,
      chatId,
      `Finish previous operation before pulling this command. Previous operation was: ${lastCommand}`
    );
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    return;
  }

  await StoreService.updateLastCommand(chatId, BOT_COMMANDS.OPEN_APP);

  await BotHelper.deleteMessage(bot, chatId, isPrivate, commandMsgId, 500);
  try {
    if (isPrivate) {
      await bot.sendMessage(chatId, "Click below to open the app: ", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Open app",
                web_app: { url: `${WEB_APP_URL}?user=${userId}` },
              },
            ],
          ],
        },
      });
    } else {
      // TODO: Provide userId as a query param to parse it inside the TWA
      await bot
        .sendMessage(chatId, "We are welcome you! Click on the link below: ", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Open app", url: `${WEB_APP_URL}?user=${userId}` }],
            ],
          },
        })
        .then((sentMsg) => {
          setTimeout(() => {
            bot.deleteMessage(chatId, sentMsg.message_id);
          }, 3000);
        });
    }
  } catch (error) {
    console.error(error);
  }
});
//ADD NEW USER TO COMMUNITY
bot.onText(/\/add/, async (msg) => {
  const userId = msg.from.id;
  const isPrivate = msg?.chat?.type === "private";
  const commandMsgId = msg.message_id;
  const chatId = msg.chat.id;

  const storeState = await StoreService.getStoreState(chatId);
  const isProcessing = storeState.current_state;
  const lastCommand = storeState.last_command;

  await BotHelper.deleteMessage(bot, chatId, isPrivate, commandMsgId, 500);
  if (isProcessing) {
    await BotHelper.send(
      bot,
      chatId,
      `Finish previous operation before pulling this command. Previous operation was: ${lastCommand}`
    );

    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    return;
  }

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

  await StoreService.updateLastCommand(chatId, BOT_COMMANDS.ADD_USER);

  const userData = await UserService.getUserData(bot, chatId, userId);
  const userPhoto = await UserService.getUserProfilePhotos(
    bot,
    userId,
    chatId,
    token
  );

  const preparedData = await UserService.formatData(
    userData,
    userPhoto,
    chatId
  );

  await UserController.addNewUser(bot, API_URL, preparedData, chatId);
});
//ADD NEW USERS TO COMMUNITY AUTOMATICALLY ON ADDING TO THE ANY CHATS
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
    const preparedData = await UserService.formatData(userData, userPhoto);

    await UserController.addNewUser(bot, API_URL, preparedData, chatId);
  });
});

//ALL INLINE MESSAGES HANDLER
bot.on("message", async (msg) => {
  const isCommand = msg.text.startsWith("/");
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const { current_state: currentState } = await StoreService.getStoreState(
    chatId
  );

  if (
    currentState === BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_INIT &&
    !isCommand
  ) {
    const { community_data } = await StoreService.getStoreState(chatId);
    if (!community_data.name) {
      await StoreService.updateCommunityName(chatId, msg.text);
      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_EDIT_NAME
      );
      await BotHelper.send(
        bot,
        chatId,
        "Please provide community description: "
      );
    }
  }

  if (
    currentState === BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_EDIT_NAME &&
    !isCommand
  ) {
    const { community_data } = await StoreService.getStoreState(chatId);

    if (!community_data.description) {
      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_EDIT_DESCRIPTION
      );
      await StoreService.updateCommunityDescription(chatId, msg.text);

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: "Yes",
              callback_data: "yes",
            },
            {
              text: "No",
              callback_data: "no",
            },
          ],
        ],
      };

      const { community_data: space } = await StoreService.getStoreState(
        chatId
      );

      bot.sendMessage(
        chatId,
        `Community name: ${space.name}\nCommunity description: ${space.description}\n\nIs it correct information?`,
        {
          reply_markup: inlineKeyboard,
        }
      );
    } else {
      console.error("Community descritpion already exists");
    }
  }
});

// INLINE MARKUP QUERY RESPONSE
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const { community_data } = await StoreService.getStoreState(chatId);

  if (community_data.name && community_data.description) {
    if (query.data === "yes") {
      await BotHelper.deleteMessage(bot, chatId, true, msgId, 500);

      bot.answerCallbackQuery(query.id, {
        text: `Your ${community_data.name} space was succesfully created!`,
      });

      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.DEFAULT
      );
      const { community_data: data } = await StoreService.getStoreState(chatId);

      if (!data.id) {
        await StoreService.updateCommunityId(chatId, chatId);
      }

      //TODO: send data to backend
    }

    if (query.data === "no") {
      bot.editMessageText(
        `Please provide community data again with command /space.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );

      bot.answerCallbackQuery(query.id, {
        text: "Community space was not created. Please try again",
      });

      await BotHelper.deleteMessage(bot, chatId, true, msgId, 500);

      await StoreService.updateCommunityName(chatId, null);
      await StoreService.updateCommunityDescription(chatId, null);
      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.DEFAULT
      );
    }

    if (query.data === "edit_community_data") {
      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_INIT
      );
      await BotHelper.send(bot, chatId, "Provide updated community name: ");
      await StoreService.updateCommunityName(chatId, null);
      await StoreService.updateCommunityDescription(chatId, null);
      await BotHelper.deleteMessage(bot, chatId, true, msgId, 500);
    }

    if (query.data === "delete_community") {
      await StoreService.updateCommunityId(chatId, null);
      await StoreService.updateCommunityName(chatId, null);
      await StoreService.updateCommunityDescription(chatId, null);
      await BotHelper.deleteMessage(bot, chatId, true, msgId, 500);
      //TODO: send data to Backend;
      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.DEFAULT
      );
      bot.answerCallbackQuery(query.id, {
        text: "Community space was deleted",
      });
    }
  }
});
