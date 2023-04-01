import dotenv from "dotenv";
import express from "express";
import md5 from "md5";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";

import UserController from "./src/controllers/UserController.js";
import BotHelper from "./src/helpers/BotHelper.js";
import UserService from "./src/services/UserService.js";
import StoreService from "./src/store/StoreService.js";
import SpaceController from "./src/controllers/SpaceController.js";
import SpaceService from "./src/services/SpaceService.js";
import GroupService from "./src/services/GroupService.js";
import GroupController from "./src/controllers/GroupController.js";
import {
  DELAY_DELETE,
  BOT_COMMANDS,
  BOT_STATE_MANAGER_MAPPING,
  BOT_NAME,
} from "./src/const.js";

dotenv.config();

const token = process.env.TG_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL;
const API_URL = process.env.API_URL;
let bot;

//BOT CONFIG
if (process.env.NODE_ENV === "production") {
  //SERVER FOR WEB HOOK AND CONFIG FOR PRODUCTION MODE
  const app = express();
  app.use(bodyParser.json());
  bot = new TelegramBot(token, { group: true });
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
  //CONFIG FOR LOCAL DEVELOPMENT
  bot = new TelegramBot(token, { polling: true, group: true });
}

//POLLING ERRORS DETECTION;
bot.on("polling_error", (error) => {
  console.log(error.code); // => 'EFATAL'
});

//WEBHOOK ERRORS DETECTION:
bot.on("webhook_error", (error) => {
  console.log(error.code); // => 'EPARSE'
});

// CREATING COMMUNITY SPACE
bot.onText(/\/space_create/, async (msg) => {
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const commandMsgId = await BotHelper.getMsgId(msg);
  const isPrivate = await BotHelper.isChatPrivate(msg);
  await BotHelper.deleteMessage(
    bot,
    chatId,
    isPrivate,
    commandMsgId,
    DELAY_DELETE.IMMEDIATELY
  );

  // CHECK THAT THIS ACTION DOESN'T CALLED INSIDE CHAT
  if (!isPrivate) {
    await BotHelper.sendDelete(
      bot,
      chatId,
      `If you want create new space for community, please send\n${BOT_COMMANDS.SPACE_CREATE}\n command to the bot\nhttps://t.me/${BOT_NAME}\nin private messages`,
      DELAY_DELETE.AFTER_5_SEC
    );
    return;
  }

  await StoreService.updateLastCommand(chatId, BOT_COMMANDS.SPACE_CREATE);
  const space = await SpaceController.getSpace(API_URL, chatId);

  if (!space) {
    //SETUP CONFIG IN STORE FOR STEPS
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_INIT
    );
    await BotHelper.send(
      bot,
      chatId,
      `Looks like you are not managing any community. Please follow instructions to create one.\n\nProvide community name: `
    );
  } else {
    const { space_name } = space;
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "⚙️ EDIT",
            callback_data: "edit_community_data",
          },
          {
            text: "🔪 DELETE",
            callback_data: "delete_community",
          },
        ],
      ],
    };
    await BotHelper.send(
      bot,
      chatId,
      `You already managing "${space_name}" community.\n\nDo you want to edit it or delete?`,
      {
        reply_markup: inlineKeyboard,
      }
    );
  }
});

//ADDING NEW USER TO COMMUNITY
bot.onText(/\/add/, async (msg) => {
  const userName = msg.from.username;
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const commandMsgId = await BotHelper.getMsgId(msg);
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const userId = await BotHelper.getUserIdByMessage(msg);

  await BotHelper.deleteMessage(
    bot,
    chatId,
    isPrivate,
    commandMsgId,
    DELAY_DELETE.IMMEDIATELY
  );

  if (isPrivate) {
    await BotHelper.sendDelete(
      bot,
      chatId,
      "If you want to add yourself to any community, please register yourself once – send the command\n/add\nin the chat of that community.",
      DELAY_DELETE.AFTER_5_SEC
    );
    return;
  }

  const userData = await UserService.getUserData(bot, chatId, userId, userName);
  const userPhoto = await UserService.getUserProfilePhotos(
    bot,
    userId,
    chatId,
    token,
    userName
  );
  const isUserExists = await UserController.checkUserExistence(API_URL, userId);
  const preparedData = await UserService.formatData(
    userData,
    userPhoto,
    chatId
  );

  if (isUserExists) {
    await UserController.UpdateUserData(bot, API_URL, preparedData);
  } else {
    await UserController.addNewUser(bot, API_URL, preparedData, chatId);
  }
});

//USER AUTHENTIFICATION
bot.onText(/\/space_login/, async (msg) => {
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const commandMsgId = await BotHelper.getMsgId(msg);
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const userId = await BotHelper.getUserIdByMessage(msg);
  const storeState = await StoreService.getStoreState(chatId);
  const { current_state: isProcessing, last_command: lastCommand } = storeState;

  await BotHelper.deleteMessage(
    bot,
    chatId,
    isPrivate,
    commandMsgId,
    DELAY_DELETE.IMMEDIATELY
  );

  if (!isPrivate) {
    await BotHelper.sendDelete(
      bot,
      chatId,
      `If you want login in the community space, please call\n${BOT_COMMANDS.SPACE_LOGIN}\n command in the private chat with bot\nhttps://t.me/${BOT_NAME}`,
      DELAY_DELETE.AFTER_5_SEC
    );
    return;
  }

  if (isProcessing) {
    await BotHelper.sendDelete(
      bot,
      chatId,
      `Finish previous operation before pulling this command. Previous operation was: ${lastCommand}`,
      DELAY_DELETE.AFTER_5_SEC
    );
    return;
  }

  await StoreService.updateLastCommand(chatId, BOT_COMMANDS.SPACE_LOGIN);

  const isUserExists = await UserController.checkUserExistence(API_URL, userId);

  if (isUserExists) {
    const updateData = {
      user_id: userId,
      user_bot_chat_id: md5(chatId),
    };
    await UserController.UpdateUserData(bot, API_URL, updateData, chatId);
  } else {
    await BotHelper.send(
      bot,
      chatId,
      `Before login in the space please call\n${BOT_COMMANDS.ADD_USER}\ncommand in the chat, which was included in the community, and after that try again to call command ${BOT_COMMANDS.SPACE_LOGIN}`
    );
  }
  await StoreService.updateLastCommand(chatId, BOT_COMMANDS.NO_COMMAND);
});

//GROUP DATA PARSING
bot.on("my_chat_member", async (msg) => {
  const isAdmin = msg.new_chat_member.status === "administrator";
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const currentGroup = await GroupController.getGroup(API_URL, chatId);

  if (isAdmin) {
    setTimeout(() => {
      console.log(
        "Small delay for telegram API response and checking bot rights"
      );
    }, DELAY_DELETE.AFTER_2_SEC);

    if (!currentGroup) {
      await BotHelper.sendDelete(
        bot,
        chatId,
        "Parsing data...",
        DELAY_DELETE.AFTER_2_SEC
      );
      const chatData = await BotHelper.getChatData(bot, chatId);
      const groupAdmins = await BotHelper.getAdministrators(bot, chatId);
      const inviteLink = await BotHelper.getInviteLink(bot, chatId);
      const preparedData = await GroupService.formatData({
        id: chatData.id,
        name: chatData.title,
        link: chatData.username
          ? `https://t.me/${chatData.username}`
          : inviteLink,
        admins: groupAdmins,
      });
      await GroupController.addNewGroup(bot, API_URL, preparedData, chatId);
    } else {
      await BotHelper.sendDelete(
        bot,
        chatId,
        "Parsing data...",
        DELAY_DELETE.AFTER_2_SEC
      );
      const { group_id } = currentGroup;
      const inviteLink = await BotHelper.getInviteLink(bot, chatId);
      await GroupController.UpdateGroupData(bot, API_URL, {
        group_id,
        group_link: inviteLink,
      });
    }
  }
});

//ADD NEW USERS TO COMMUNITY AUTOMATICALLY ON ADDING TO THE ANY CHATS
bot.on("new_chat_members", async (msg) => {
  const newMembers = msg.new_chat_members;

  const chatId = await BotHelper.getChatIdByMessage(msg);

  newMembers.forEach(async (member) => {
    if (member.is_bot) {
      return;
    }
    const userId = member.id;
    const userName = member.username;
    const userData = await UserService.getUserData(
      bot,
      chatId,
      userId,
      userName
    );
    const userPhoto = await UserService.getUserProfilePhotos(
      bot,
      userId,
      chatId,
      token
    );
    const isUserExists = await UserController.checkUserExistence(
      API_URL,
      userId
    );
    const preparedData = await UserService.formatData(
      userData,
      userPhoto,
      chatId
    );

    if (isUserExists) {
      await UserController.UpdateUserData(bot, API_URL, preparedData);
    } else {
      await UserController.addNewUser(bot, API_URL, preparedData, chatId);
    }
  });
});

//OPEN APP
bot.onText(/\/open_app/, async (msg) => {
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const commandMsgId = await BotHelper.getMsgId(msg);
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const userId = await BotHelper.getUserIdByMessage(msg);

  const { current_state: isProcessing, last_command: lastCommand } =
    await StoreService.getStoreState(chatId);

  if (isProcessing) {
    await BotHelper.send(
      bot,
      chatId,
      `Finish previous operation before pulling this command. Previous operation was: ${lastCommand}`
    );
    return;
  }

  await StoreService.updateLastCommand(chatId, BOT_COMMANDS.OPEN_APP);
  await BotHelper.deleteMessage(
    bot,
    chatId,
    isPrivate,
    commandMsgId,
    DELAY_DELETE.IMMEDIATELY
  );

  const userData = await UserController.getUser(API_URL, userId);
  const loginData = userData && userData.user_bot_chat_id;

  if (isPrivate) {
    if (loginData) {
      await bot
        .sendMessage(chatId, "Click below to open the app: ", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Open app",
                  web_app: {
                    url: `${WEB_APP_URL}?user_id=${userId}&private_id=${loginData}`,
                  },
                },
              ],
            ],
          },
        })
        .then((sentMsg) => {
          bot.pinChatMessage(chatId, sentMsg.message_id);
        });
    } else {
      await BotHelper.send(
        bot,
        chatId,
        `Before you will have access to community you should:\n1) call ${BOT_COMMANDS.ADD_USER} in any group of this community\n2)authorize yourself, just call ${BOT_COMMANDS.SPACE_LOGIN} here, in a private chat with this bot.\nThis will give you full access to community space.`
      );
    }
  } else {
    await BotHelper.send(
      bot,
      userId,
      `Hi!\nYou can open your application if you has been added and authorized in the space.\nBefore you will have access to community you should:\n1) call ${BOT_COMMANDS.ADD_USER} in any group of this community\n2)authorize yourself, just call ${BOT_COMMANDS.SPACE_LOGIN} here, in a private chat with this bot.This will give you full access to community space.\n3)After that just run ${BOT_COMMANDS.OPEN_APP} to get your personal link.\nThank you, hope to see you in your cozy space! ❤️`
    );
  }

  await StoreService.updateLastCommand(chatId, BOT_COMMANDS.NO_COMMAND);
});

//HELP COMMAND
bot.onText(/\/help/, async (msg) => {
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const msgId = await BotHelper.getMsgId(msg);

  await BotHelper.deleteMessage(
    bot,
    chatId,
    isPrivate,
    msgId,
    DELAY_DELETE.IMMEDIATELY
  );

  const helpText = `/help - show all available commands\n/space_create - create your own space\n/add - add yourself to the space (active in workchat)\n/space_login - authorize in community space\n/open_app - get personal link to the space`;

  if (isPrivate) {
    await BotHelper.send(bot, chatId, helpText);
  }
});

//ALL INLINE MESSAGES HANDLER
bot.on("message", async (msg) => {
  const isCommand = msg.pinned_message
    ? msg?.pinned_message?.text.startsWith("/")
    : msg?.text?.startsWith("/");
  const isPinnedMessage = msg?.pinned_message;

  const chatId = await BotHelper.getChatIdByMessage(msg);
  const { current_state: currentState, community_data } =
    await StoreService.getStoreState(chatId);

  // Create space name
  if (
    currentState === BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_INIT &&
    !isCommand &&
    !isPinnedMessage
  ) {
    if (!community_data.name) {
      await StoreService.updateCommunityName(chatId, msg.text);
      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.SPACE_EDIT_NAME
      );

      await BotHelper.send(
        bot,
        chatId,
        "Please provide community description: "
      );
    }
  }

  // Create space description
  if (
    currentState === BOT_STATE_MANAGER_MAPPING.SPACE_EDIT_NAME &&
    !isCommand &&
    !isPinnedMessage
  ) {
    if (!community_data.description) {
      await StoreService.updateCommunityDescription(chatId, msg.text);
      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.SPACE_EDIT_DESCRIPTION
      );
      const { community_data: space } = await StoreService.getStoreState(
        chatId
      );
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ Yes",
              callback_data: "yes",
            },
            {
              text: "🚫 No",
              callback_data: "no",
            },
          ],
        ],
      };
      bot.sendMessage(
        chatId,
        `Community name: ${space.name}\nCommunity description: ${space.description}\n\nIs it correct information?`,
        {
          reply_markup: inlineKeyboard,
        }
      );
    }
  }
});

// INLINE MARKUP QUERY RESPONSE
bot.on("callback_query", async (query) => {
  const chatId = await BotHelper.getChatIdByMessage(query?.message);
  const userId = await BotHelper.getUserIdByMessage(query);
  const msgId = await BotHelper.getMsgId(query.message);

  if (query.data === "yes") {
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );
    const space = await SpaceController.getSpace(API_URL, chatId);

    if (!space) {
      await StoreService.updateCommunityId(chatId, chatId);
      const { community_data: data } = await StoreService.getStoreState(chatId);
      const preparedData = await SpaceService.formatData(data, userId);
      await SpaceController.addNewSpace(bot, API_URL, preparedData, chatId);
      bot.answerCallbackQuery(query.id, {
        text: `Your ${data.name} space was succesfully created!`,
      });
    } else {
      const { space_id, space_owner_id } = space;
      await StoreService.updateCommunityId(chatId, space_id);
      const { community_data: data } = await StoreService.getStoreState(chatId);
      const preparedData = await SpaceService.formatData(data, space_owner_id);
      await SpaceController.UpdateSpaceData(bot, API_URL, preparedData, chatId);
      bot.answerCallbackQuery(query.id, {
        text: `Your ${data.name} space was succesfully updated!`,
      });
    }

    await StoreService.updateCommunityName(chatId, null);
    await StoreService.updateCommunityDescription(chatId, null);
    await StoreService.updateCommunityId(chatId, null);
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    await StoreService.updateLastCommand(BOT_COMMANDS.NO_COMMAND);
  }

  if (query.data === "no") {
    bot.editMessageText(
      `Please provide community data again with command /space_create.`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
      }
    );

    bot.answerCallbackQuery(query.id, {
      text: "Community space was not created. Please try again",
    });

    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.AFTER_2_SEC
    );
    await StoreService.updateCommunityName(chatId, null);
    await StoreService.updateCommunityDescription(chatId, null);
    await StoreService.updateCommunityId(chatId, null);
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    await StoreService.updateLastCommand(chatId, BOT_COMMANDS.NO_COMMAND);
  }

  if (query.data === "edit_community_data") {
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_INIT
    );
    await BotHelper.send(bot, chatId, "Provide updated community name: ");
    await StoreService.updateCommunityName(chatId, null);
    await StoreService.updateCommunityDescription(chatId, null);
    await StoreService.updateCommunityId(chatId, null);
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );
  }

  if (query.data === "delete_community") {
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🔪 I'm sure, DELETE ",
            callback_data: "delete_forever",
          },
          {
            text: "🚫 CANCEL",
            callback_data: "cancel_operation",
          },
        ],
      ],
    };
    await BotHelper.send(
      bot,
      chatId,
      `ARE YOU SURE THAT YOU WANT DELETE YOUR SPACE?`,
      {
        reply_markup: inlineKeyboard,
      }
    );
  }

  if (query.data === "delete_forever") {
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );

    await StoreService.updateCommunityId(chatId, null);
    await StoreService.updateCommunityName(chatId, null);
    await StoreService.updateCommunityDescription(chatId, null);
    await StoreService.updateLastCommand(BOT_COMMANDS.NO_COMMAND);
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    await SpaceController.DeleteSpace(bot, API_URL, chatId, chatId);
    bot.answerCallbackQuery(query.id, {
      text: "Community space was deleted",
    });
  } else if (query.data === "cancel_operation") {
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    await StoreService.updateLastCommand(BOT_COMMANDS.NO_COMMAND);
    await BotHelper.sendDelete(
      bot,
      chatId,
      "Ok, your space still exists. Just open app: \n/open_app\nto manage it",
      DELAY_DELETE.AFTER_2_SEC
    );
  }
});
