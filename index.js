import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import md5 from "md5";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";

import BotHelper from "./src/helpers/BotHelper.js";

import UserService from "./src/services/UserService.js";
import SpaceService from "./src/services/SpaceService.js";
import StoreService from "./src/store/StoreService.js";
import GroupService from "./src/services/GroupService.js";
import MessageService from "./src/services/MessageService.js";
import FileUploadService from "./src/services/FileUploadService.js";

import UserController from "./src/controllers/UserController.js";
import SpaceController from "./src/controllers/SpaceController.js";
import GroupController from "./src/controllers/GroupController.js";
import MessageController from "./src/controllers/MessageController.js";
import EventController from "./src/controllers/EventController.js";

import {
  DELAY_DELETE,
  BOT_COMMANDS,
  BOT_STATE_MANAGER_MAPPING,
  BOT_NAME,
} from "./src/const.js";
import FileController from "./src/controllers/FileController.js";
import EventService from "./src/services/EventService.js";

dotenv.config();

const token = process.env.TG_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL;
const API_URL = process.env.API_URL;
// const FAKE_API_URL = process.env.FAKE_API_URL;

let bot;

//BOT CONFIG
if (process.env.NODE_ENV === "production") {
  //SERVER FOR WEB HOOK AND CONFIG FOR PRODUCTION MODE
  const app = express();
  app.use(bodyParser.json());
  app.use(cors());
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

  //SENDING FILE TO USER IN PRIVATE MESSAGE ON DOWNLOAD IN TWA
  app.post("/send-file", async (req, res) => {
    try {
      const { chatId, fileUrl, fileName, fileMime } = req.body;
      const buffer = await FileController.prepareURLToBuffer(fileUrl);

      await BotHelper.send(
        bot,
        chatId,
        "Here is your file. Now you can download or share it, as you wish: "
      );

      await bot.sendDocument(
        chatId,
        buffer,
        {},
        { filename: fileName, contentType: fileMime }
      );
      res.status(200).send({ status: "success" });
    } catch (error) {
      res.status(500).send({ status: "failed" });
      throw new Error(error.message);
    }
  });

  app.post("/send-contact", async (req, res) => {
    try {
      const { data } = req.body;

      if (data && data.length) {
        data.forEach(async (userId, index) => {
          const currentUser = await UserController.getUser(API_URL, userId);
          const otherUser =
            index === 0
              ? await UserController.getUser(API_URL, data[1])
              : await UserController.getUser(API_URL, data[0]);

          const message = `Hi! It's a MAAAAAATCH!!!\nLooks like you have something to discuss with ${
            otherUser.user_name || "Anonymous"
          } ${
            otherUser?.user_last_name || ""
          }.\n Some info about your contact:\n${
            otherUser.user_description || ""
          }.\n________________________________\nDo not wait, text him immediately: @${
            otherUser.user_telegram_link
          } !\n Good luck, hope this connection bring you new opportunities! ❤️`;

          await BotHelper.send(bot, currentUser.user_id, message);
        });
        res.status(200).send({ status: "success" });
      }
    } catch (error) {
      res.status(500).send({ status: "failed" });
    }
  });

  app.post("/verify-event", async (req, res) => {
    try {
      const data = req.body;
      const space = await SpaceController.getSpace(
        API_URL,
        data.event_space_id
      );
      const { spaceOwner } = space;

      const eventAgendaMessage =
        EventService.prepareEventMessageToChatSending(data);

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: "🆗 PUBLISH",
              callback_data: "accept_event",
            },
            {
              text: "🚫 DECLINE",
              callback_data: "decline_event",
            },
          ],
        ],
      };
      await BotHelper.send(bot, spaceOwner, eventAgendaMessage, {
        reply_markup: inlineKeyboard,
        parse_mode: "Markdown",
      });

      res.status(200).send({ status: "success" });
    } catch (error) {
      console.log(error);
      res.status(500).send({ status: "failed" });
    }
  });

  app.post("/add-to-calendar", async (req, res) => {
    try {
      const data = req.body;

      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
URL:tolstov.me
DTSTART:20230427T204000Z
DTEND:20230427T214000Z
SUMMARY:Таро под пивчик
DESCRIPTION:Прекрасный эвент который будет проходить в онлайне. \\nТолько представьте вы в онлайне, сидите в вашем удобном кресле перед компьютером и слушаете про свою судьбу. \\nИ заливаете душевные травмы холодненьким пивком. 
END:VEVENT
END:VCALENDAR`;

      const dataUri = `data:text/calendar;charset=utf8,${encodeURIComponent(
        icsData
      )}`;

      console.log(data);

      // const inlineKeyboardButton = {
      //   text: data.fileName,
      //   url: data.fileUrl,
      // };

      // const inlineKeyboard = {
      //   inline_keyboard: [[inlineKeyboardButton]],
      // };

      bot.sendDocument(data.chatId, dataUri, {
        fileName: "event.ics",
        mimeType: "text/calendar",
      });

      // await BotHelper.send(
      //   bot,
      //   data.chatId,
      //   `[${data.fileUrl}](${data.fileName})`,
      //   {
      //     parse_mode: "Markdown",
      //   }
      // );

      res.status(200).send({ status: "success" });
    } catch (error) {
      console.log(error);
      res.status(500).send({ status: "failed" });
    }
  });

  app.post("/share-event", async (req, res) => {
    try {
      const data = req.body;
      console.log(data);
      res.status(200).send({ status: "success" });
    } catch (error) {
      console.log(error);
      res.status(500).send({ status: "failed" });
    }
  });
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
  if (
    msg.text === "/space_create" ||
    msg.text === `/space_create@${BOT_NAME}`
  ) {
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
      //SETUP CONFIG IN STORE FOR PROPER STEPS
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
      const { spaceName } = space;
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
            {
              text: "🚫 CANCEL",
              callback_data: "cancel_space_create",
            },
          ],
        ],
      };
      await BotHelper.send(
        bot,
        chatId,
        `You already managing "${spaceName}" community.\n\nDo you want to edit it or delete?`,
        {
          reply_markup: inlineKeyboard,
        }
      );
    }
  } else {
    return;
  }
});

//ADDING NEW USER TO COMMUNITY
bot.onText(/\/add/, async (msg) => {
  if (msg.text === "/add" || msg.text === `/add@${BOT_NAME}`) {
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

    const userData = await UserService.parseUserFromChat(
      bot,
      chatId,
      userId,
      userName
    );

    const userPhoto = await UserService.parseUserProfilePhotosOnAdd(
      bot,
      userId,
      chatId,
      token,
      userName
    );

    const userFromDB = await UserController.getUser(API_URL, userId);

    const preparedData = await UserService.formatData(
      userData,
      userPhoto,
      chatId,
      userFromDB
    );

    if (userFromDB) {
      await UserController.UpdateUserData(bot, API_URL, preparedData);
    } else {
      await UserController.addNewUser(bot, API_URL, preparedData, chatId);
    }
  } else {
    return;
  }
});

//USER AUTHENTIFICATION
bot.onText(/\/space_login/, async (msg) => {
  if (msg.text === "/space_login" || msg.text === `/space_login@${BOT_NAME}`) {
    const chatId = await BotHelper.getChatIdByMessage(msg);
    const commandMsgId = await BotHelper.getMsgId(msg);
    const isPrivate = await BotHelper.isChatPrivate(msg);
    const userId = await BotHelper.getUserIdByMessage(msg);
    const storeState = await StoreService.getStoreState(chatId);
    const { current_state: isProcessing, last_command: lastCommand } =
      storeState;

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

    const userFromDB = await UserController.getUser(API_URL, userId);

    if (userFromDB) {
      const updateData = {
        user_id: userId,
        user_bot_chat_id: md5(chatId.toString()),
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
  } else {
    return;
  }
});

//GROUP DATA PARSING
bot.on("my_chat_member", async (msg) => {
  const isAdmin = msg.new_chat_member.status === "administrator";
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const currentGroup = await GroupController.getGroup(API_URL, chatId);
  const chatType = msg.chat.type;

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
        type: chatType,
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
    const userData = await UserService.parseUserFromChat(
      bot,
      chatId,
      userId,
      userName
    );
    const userPhoto = await UserService.parseUserProfilePhotosOnAdd(
      bot,
      userId,
      chatId,
      token,
      userName
    );
    const userFromDB = await UserController.getUser(API_URL, userId);

    const preparedData = await UserService.formatData(
      userData,
      userPhoto,
      chatId,
      userFromDB
    );

    if (userFromDB) {
      await UserController.UpdateUserData(bot, API_URL, preparedData);
    } else {
      await UserController.addNewUser(bot, API_URL, preparedData, chatId);
    }
  });
});

//OPEN APP
bot.onText(/\/open_app/, async (msg) => {
  if (msg.text === "/open_app" || msg.text === `/open_app@${BOT_NAME}`) {
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
  } else {
    return;
  }
});

//HELP COMMAND
bot.onText(/\/help/, async (msg) => {
  if (msg.text === "/help" || msg.text === `/help@${BOT_NAME}`) {
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

    const helpText = `/help - show all available commands\n/space_create - create your own space\n/add - add yourself to the space (active in workchat)\n/space_login - authorize in community space\n/open_app - get personal link to the space\n\nIf you already have created community space you can upload new files to this space - just send it as *FILE* to this bot`;

    if (isPrivate) {
      await BotHelper.send(bot, chatId, helpText);
    }
  } else {
    return;
  }
});

bot.on("channel_post", async (msg) => {
  if (msg.text && msg.text.includes("#")) {
    const chatId = await BotHelper.getChatIdByMessage(msg);
    const msgText = msg.text;
    const userName = msg.author_signature ?? "Anonymous";
    const link = await BotHelper.getMsgLink(msg);
    const msgId = await BotHelper.getMsgId(msg);
    const tags = await BotHelper.extractHashtags(msg.text);
    const date = await BotHelper.getMsgDate(msg);

    const preparedData = await MessageService.formatData({
      chatId,
      link,
      msgId,
      tags,
      date,
      msgText,
      userName,
    });

    await MessageController.createMessage(API_URL, preparedData);
  }
});

bot.on("edited_channel_post", async (msg) => {
  if (msg.text && msg.text.includes("#")) {
    const chatId = await BotHelper.getChatIdByMessage(msg);
    const msgText = msg.text;
    const userName = msg.author_signature ?? "Anonymous";
    const link = await BotHelper.getMsgLink(msg);
    const msgId = await BotHelper.getMsgId(msg);
    const tags = await BotHelper.extractHashtags(msg.text);
    const date = await BotHelper.getMsgDate(msg);

    const preparedData = await MessageService.formatData({
      chatId,
      link,
      msgId,
      tags,
      date,
      msgText,
      userName,
    });

    await MessageController.updateMessage(API_URL, preparedData);
  }
});

//ALL INLINE MESSAGES HANDLER
bot.on("message", async (msg) => {
  const isFromBot = await BotHelper.checkIsFromBot(msg);
  const isPrivate = await BotHelper.isChatPrivate(msg);
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
      await StoreService.updateLastCommand(chatId, BOT_COMMANDS.SPACE_CREATE);

      await BotHelper.send(
        bot,
        chatId,
        "Please provide community description: "
      );
    }
    return;
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
      await StoreService.updateLastCommand(chatId, BOT_COMMANDS.SPACE_CREATE);
      const { community_data: space } = await StoreService.getStoreState(
        chatId
      );
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ Yes",
              callback_data: "correct_space_information",
            },
            {
              text: "🚫 No",
              callback_data: "incorrect_space_information",
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
    return;
  }

  if (
    !isFromBot &&
    !isPrivate &&
    !isCommand &&
    !isPinnedMessage &&
    msg.text &&
    msg?.text?.includes("#")
  ) {
    const msgText = msg.text;
    const userName = `${msg?.from?.first_name ?? ""} ${
      msg?.from?.last_name ?? ""
    }`;
    const userId = await BotHelper.getUserIdByMessage(msg);
    const link = await BotHelper.getMsgLink(msg);
    const msgId = await BotHelper.getMsgId(msg);
    const tags = await BotHelper.extractHashtags(msg.text);
    const date = await BotHelper.getMsgDate(msg);
    const userPhoto = await UserService.getUserPhotoFromTg(bot, userId, token);

    const preparedData = await MessageService.formatData({
      userId,
      chatId,
      link,
      msgId,
      tags,
      date,
      msgText,
      userName,
      userPhoto,
    });

    await MessageController.createMessage(API_URL, preparedData);
  }
});

bot.on("edited_message", async (msg) => {
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const isCommand = msg.pinned_message
    ? msg?.pinned_message?.text.startsWith("/")
    : msg?.text?.startsWith("/");
  const isPinnedMessage = msg?.pinned_message;

  if (
    !isPrivate &&
    !isCommand &&
    !isPinnedMessage &&
    msg.text &&
    msg?.text?.includes("#")
  ) {
    const chatId = await BotHelper.getChatIdByMessage(msg);
    const msgText = msg.text;
    const userName = `${msg?.from?.first_name ?? ""} ${
      msg?.from?.last_name ?? ""
    }`;
    const userId = await BotHelper.getUserIdByMessage(msg);
    const link = await BotHelper.getMsgLink(msg);
    const msgId = await BotHelper.getMsgId(msg);
    const tags = await BotHelper.extractHashtags(msg.text);
    const date = await BotHelper.getMsgDate(msg);
    const userPhoto = await UserService.getUserPhotoFromTg(bot, userId, token);

    const preparedData = await MessageService.formatData({
      userId,
      chatId,
      link,
      msgId,
      tags,
      date,
      msgText,
      userName,
      userPhoto,
    });

    await MessageController.updateMessage(API_URL, preparedData);
  }
});

// INLINE MARKUP QUERY RESPONSE
bot.on("callback_query", async (query) => {
  const chatId = await BotHelper.getChatIdByMessage(query?.message);
  const userId = await BotHelper.getUserIdByMessage(query);
  const msgId = await BotHelper.getMsgId(query.message);

  if (query.data === "accept_event") {
    const exctractedId = await EventService.extractEventid(query.message.text);
    if (exctractedId && exctractedId.length) {
      const id = exctractedId[0];
      const updatedEvent = await EventController.updateEvent(API_URL, id);
      if (updatedEvent) {
        bot.answerCallbackQuery(query.id, {
          text: `Event was succesfully added to community space`,
        });
      } else {
        bot.answerCallbackQuery(query.id, {
          text: `There is no such event to update`,
        });
      }
      await BotHelper.deleteMessage(
        bot,
        chatId,
        true,
        msgId,
        DELAY_DELETE.IMMEDIATELY
      );
    }
  } else if (query.data === "decline_event") {
    const exctractedId = await EventService.extractEventid(query.message.text);
    if (exctractedId && exctractedId.length) {
      const id = exctractedId[0];
      const deletedEvent = await EventController.deleteEvent(API_URL, id);
      if (deletedEvent) {
        bot.answerCallbackQuery(query.id, {
          text: `Event was declined and deleted`,
        });
      } else {
        bot.answerCallbackQuery(query.id, {
          text: `Event was already deleted`,
        });
      }
      await BotHelper.deleteMessage(
        bot,
        chatId,
        true,
        msgId,
        DELAY_DELETE.IMMEDIATELY
      );
    }
  }

  if (query.data === "correct_space_information") {
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
      const { spaceId, spaceOwner } = space;
      await StoreService.updateCommunityId(chatId, spaceId);
      const { community_data: data } = await StoreService.getStoreState(chatId);
      const preparedData = await SpaceService.formatData(data, spaceOwner);
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
    await StoreService.updateLastCommand(chatId, BOT_COMMANDS.NO_COMMAND);
  } else if (query.data === "incorrect_space_information") {
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
  } else if (query.data === "delete_community") {
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🔪 I'm sure, DELETE ",
            callback_data: "delete_space_forever",
          },
          {
            text: "🚫 CANCEL",
            callback_data: "cancel_space_delete",
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

  if (query.data === "delete_space_forever") {
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
  } else if (
    query.data === "cancel_space_delete" ||
    query.data === "cancel_space_create"
  ) {
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

  if (query.data === "upload_file") {
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );
    const { file_data: data } = await StoreService.getStoreState(chatId);
    const fileUrl = await bot.getFileLink(data.file_id);

    const preparedData = await FileUploadService.formatData({
      ...data,
      file_url: fileUrl,
    });

    await FileController.uploadFile(bot, API_URL, preparedData, chatId);
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    await StoreService.updateLastCommand(chatId, BOT_COMMANDS.NO_COMMAND);
  } else if (query.data === "cancel_upload") {
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );

    await StoreService.resetCurrentFile(chatId);
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.DEFAULT
    );
    await StoreService.updateLastCommand(chatId, BOT_COMMANDS.NO_COMMAND);
  }
});

bot.on("audio", async (msg) => {
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const msgId = await BotHelper.getMsgId(msg);

  if (isPrivate) {
    const space = await SpaceController.getSpace(API_URL, chatId);
    if (!space) {
      await BotHelper.send(
        bot,
        chatId,
        `You didn't create any space for uploading files\nIf you want to manage your own space, please run command\n${BOT_COMMANDS.SPACE_CREATE}\nto create one.`
      );
      return;
    } else {
      const { current_state: state } = await StoreService.getStoreState(chatId);

      const { spaceName, spaceId } = space;
      const file = msg?.audio ?? null;

      if (state) {
        await BotHelper.send(
          bot,
          chatId,
          `Finish previous upload before sending new file.`
        );
        return;
      }

      if (file) {
        await StoreService.updateCurrentState(
          chatId,
          BOT_STATE_MANAGER_MAPPING.SPACE_FILE_UPLOAD
        );

        await StoreService.updateLastCommand(chatId, "file upload");

        await StoreService.prepareCurrentFileForUpload(chatId, {
          ...file,
          to_space: spaceId,
        });

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "☁️ UPLOAD",
                callback_data: "upload_file",
              },
              {
                text: "🚫 CANCEL",
                callback_data: "cancel_upload",
              },
            ],
          ],
        };

        await BotHelper.sendDelete(
          bot,
          chatId,
          "Yummy...",
          DELAY_DELETE.AFTER_2_SEC
        );

        await BotHelper.deleteMessage(
          bot,
          chatId,
          isPrivate,
          msgId,
          DELAY_DELETE.IMMEDIATELY
        );

        await BotHelper.send(
          bot,
          chatId,
          `Do you want to upload ${file.file_name} to "${spaceName}" community?\n\n`,
          {
            reply_markup: inlineKeyboard,
          }
        );
      }
    }
  }
});

bot.on("document", async (msg) => {
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const msgId = await BotHelper.getMsgId(msg);

  if (isPrivate) {
    const space = await SpaceController.getSpace(API_URL, chatId);
    if (!space) {
      await BotHelper.send(
        bot,
        chatId,
        `You didn't create any space for uploading files\nIf you want to manage your own space, please run command\n${BOT_COMMANDS.SPACE_CREATE}\nto create one.`
      );
      return;
    } else {
      const { current_state: state } = await StoreService.getStoreState(chatId);

      const { spaceName, spaceId } = space;
      const file = msg?.document ?? null;

      if (state) {
        await BotHelper.send(
          bot,
          chatId,
          `Finish previous upload before sending new file.`
        );
        return;
      }

      if (file) {
        await StoreService.updateCurrentState(
          chatId,
          BOT_STATE_MANAGER_MAPPING.SPACE_FILE_UPLOAD
        );

        await StoreService.updateLastCommand(chatId, "file upload");

        await StoreService.prepareCurrentFileForUpload(chatId, {
          ...file,
          to_space: spaceId,
        });

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "☁️ UPLOAD",
                callback_data: "upload_file",
              },
              {
                text: "🚫 CANCEL",
                callback_data: "cancel_upload",
              },
            ],
          ],
        };

        await BotHelper.sendDelete(
          bot,
          chatId,
          "Yummy...",
          DELAY_DELETE.AFTER_2_SEC
        );

        await BotHelper.deleteMessage(
          bot,
          chatId,
          isPrivate,
          msgId,
          DELAY_DELETE.IMMEDIATELY
        );

        await BotHelper.send(
          bot,
          chatId,
          `Do you want to upload ${file.file_name} to "${spaceName}" community?\n\n`,
          {
            reply_markup: inlineKeyboard,
          }
        );
      }
    }
  }
});

bot.on("video", async (msg) => {
  const isPrivate = await BotHelper.isChatPrivate(msg);
  const chatId = await BotHelper.getChatIdByMessage(msg);
  const msgId = await BotHelper.getMsgId(msg);

  if (isPrivate) {
    const space = await SpaceController.getSpace(API_URL, chatId);
    if (!space) {
      await BotHelper.send(
        bot,
        chatId,
        `You didn't create any space for uploading files\nIf you want to manage your own space, please run command\n${BOT_COMMANDS.SPACE_CREATE}\nto create one.`
      );
      return;
    } else {
      const { current_state: state } = await StoreService.getStoreState(chatId);

      const { spaceName, spaceId } = space;
      const file = msg?.video ?? null;

      if (state) {
        await BotHelper.send(
          bot,
          chatId,
          `Finish previous upload before sending new file.`
        );
        return;
      }

      if (file) {
        await StoreService.updateCurrentState(
          chatId,
          BOT_STATE_MANAGER_MAPPING.SPACE_FILE_UPLOAD
        );

        await StoreService.updateLastCommand(chatId, "file upload");

        await StoreService.prepareCurrentFileForUpload(chatId, {
          ...file,
          to_space: spaceId,
        });

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "☁️ UPLOAD",
                callback_data: "upload_file",
              },
              {
                text: "🚫 CANCEL",
                callback_data: "cancel_upload",
              },
            ],
          ],
        };

        await BotHelper.sendDelete(
          bot,
          chatId,
          "Yummy...",
          DELAY_DELETE.AFTER_2_SEC
        );

        await BotHelper.deleteMessage(
          bot,
          chatId,
          isPrivate,
          msgId,
          DELAY_DELETE.IMMEDIATELY
        );

        await BotHelper.send(
          bot,
          chatId,
          `Do you want to upload ${file.file_name} to "${spaceName}" community?\n\n`,
          {
            reply_markup: inlineKeyboard,
          }
        );
      }
    }
  }
});
