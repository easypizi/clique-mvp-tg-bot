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

          const fullName = `*${otherUser.user_name || "Anonymous"}* *${
            otherUser?.user_last_name || ""
          }*`;

          const description = otherUser.user_description
            ? `${otherUser.user_description}.`
            : "Mysterious person...";

          const tgLink = `\@${otherUser.user_telegram_link}`;

          const message = `🌟 *It's a match!!!* 🌟\n\nLooks like you have something to discuss with ${fullName}.\n____________________________\n*Some info about your contact:*\n${description}\n\nDo not wait, text immediately: ${tgLink} !\n\n*Good luck, hope this connection bring you new opportunities!*`;

          const screenedMessage = message.replaceAll("_", "\\_");

          await BotHelper.send(bot, currentUser.user_id, screenedMessage, {
            parse_mode: "Markdown",
          });
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
        EventService.prepareEventMessageToAdminCheck(data);

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

  app.post("/share-event", async (req, res) => {
    try {
      const data = req.body;
      const { event_id, groups_to_share } = data;
      const eventData = await EventController.getEvent(API_URL, event_id);

      if (eventData) {
        const preparedMessage =
          EventService.prepareEventMessageToPublish(eventData);

        groups_to_share.forEach(async (groupId) => {
          await BotHelper.send(bot, groupId, preparedMessage, {
            parse_mode: "Markdown",
          });
        });

        res.status(200).send({ status: "success" });
      }
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

//DELETE USER DATA FROM SPACE OR FROM APPLICATION
bot.onText(/\/delete/, async (ctx) => {
  if (ctx.text === "/delete" || ctx.text === `/delete@${BOT_NAME}`) {
    const userName = ctx.from.username;
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const commandMsgId = await BotHelper.getMsgId(ctx);
    const isPrivate = await BotHelper.isChatPrivate(ctx);
    const userId = await BotHelper.getUserIdByMessage(ctx);

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
        `Если вы хотите удалить себя из любого сообщества или удалить свой профиль, вызовите эту команду в приватном диалоге с @${BOT_NAME}`,
        DELAY_DELETE.AFTER_5_SEC
      );
      return;
    }

    const userData = await UserController.getUser(API_URL, userId);

    if (userData && userData.user_spaces && userData.user_spaces.length) {
      const spacesIdString = userData.user_spaces.join(",");

      const spaces = await SpaceController.getUserSpacesByQueryId(
        API_URL,
        spacesIdString
      );

      const msgText = `Вы можете удалить себя из любого сообщества в котором состоите, на ваш выбор. Ваши данные не будут отображаться в этом сообществе.\nКакое сообщество вы хотите покинуть?\n\nЕсли вы хотите вообще удалить свой профиль, для этого есть кнопка ниже.`;

      const inlineButtons = spaces.map((space, index) => {
        return {
          text: `${index + 1}. ${space.space_name}`,
          callback_data: JSON.stringify({
            command: "delete_from_space",
            data: { space_id: space.space_id },
          }),
        };
      });

      const inlineKeyboard = {
        inline_keyboard: [
          inlineButtons,
          [
            {
              text: "🗑️ УДАЛИТЬ ПРОФИЛЬ",
              callback_data: "delete_user_profile",
            },
          ],
        ],
      };

      await BotHelper.send(bot, chatId, msgText, {
        reply_markup: inlineKeyboard,
      });
    }
  }
});

// CREATING COMMUNITY SPACE
bot.onText(/\/space_create/, async (ctx) => {
  if (
    ctx.text === "/space_create" ||
    ctx.text === `/space_create@${BOT_NAME}`
  ) {
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const commandMsgId = await BotHelper.getMsgId(ctx);
    const isPrivate = await BotHelper.isChatPrivate(ctx);
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
        `Если вы хотите создать пространство для сообщества, пришлите\n${BOT_COMMANDS.SPACE_CREATE}\nкоманду нашему боту:\nhttps://t.me/${BOT_NAME} в приватном чате`,
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
        `Похоже у вас еще нет пространства сообщества! Пожалуйста пройдите несколько шагов, чтобы создать такое пространство\n\nУкажите имя пространства для сообщества:`
      );
    } else {
      const { spaceName } = space;
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: "⚙️ РЕДАКТИРОВАТЬ",
              callback_data: "edit_community_data",
            },
          ],
          [
            {
              text: "🔪 УДАЛИТЬ",
              callback_data: "delete_community",
            },
          ],
          [
            {
              text: "🚫 ОТМЕНА",
              callback_data: "cancel_space_create",
            },
          ],
        ],
      };
      await BotHelper.sendDelete(
        bot,
        chatId,
        `Вы уже управляет *"${spaceName.replaceAll(
          "_",
          "\\_"
        )}"* сообществом.\nВы хотите отредактировать его или удалить? Вы можете отменить данную операцию в любой момент.`,
        DELAY_DELETE.AFTER_5_SEC * 2,
        {
          parse_mode: "Markdown",
          reply_markup: inlineKeyboard,
        }
      );
    }
  } else {
    return;
  }
});

//ADDING NEW USER TO COMMUNITY
bot.onText(/\/add/, async (ctx) => {
  if (ctx.text === "/add" || ctx.text === `/add@${BOT_NAME}`) {
    const userName = ctx.from.username;
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const commandMsgId = await BotHelper.getMsgId(ctx);
    const isPrivate = await BotHelper.isChatPrivate(ctx);
    const userId = await BotHelper.getUserIdByMessage(ctx);

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
        `Если вы хотите добавить себя в любой сообщество, зарегистрируйте себя единожды - просто отправьте команду:\n${BOT_COMMANDS.ADD_USER}\n в любом чате, где данный бот является администратором`,
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
      await UserController.updateUserData(bot, API_URL, preparedData);
    } else {
      await UserController.addNewUser(bot, API_URL, preparedData, chatId);
    }
  } else {
    return;
  }
});

//USER AUTHENTIFICATION
bot.onText(/\/space_login/, async (ctx) => {
  if (ctx.text === "/space_login" || ctx.text === `/space_login@${BOT_NAME}`) {
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const commandMsgId = await BotHelper.getMsgId(ctx);
    const isPrivate = await BotHelper.isChatPrivate(ctx);
    const userId = await BotHelper.getUserIdByMessage(ctx);
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
        `Если вы хотите аутентифицироваться и получить доступ к сообществу, вызовите ${BOT_COMMANDS.SPACE_LOGIN} команду в приватном диалоге с нашим ботом:\nhttps://t.me/${BOT_NAME}`,
        DELAY_DELETE.AFTER_5_SEC
      );
      return;
    }

    if (isProcessing) {
      await BotHelper.sendDelete(
        bot,
        chatId,
        `Завершите предыдущую операцию перед выполнением этой команды.\nПредыдущая операция была: ${lastCommand}`,
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
      await UserController.updateUserData(bot, API_URL, updateData, chatId);
    } else {
      await BotHelper.send(
        bot,
        chatId,
        `Прежде чем аутентифицироваться в пространстве сообщества вам необходимо добавить себя в это сообщество. Это можно сделать вызвав команду: \n${BOT_COMMANDS.ADD_USER} в любом чате, где данный бот установлен в качестве администратора. После этого можете пройти авторизацию вызвав ${BOT_COMMANDS.SPACE_LOGIN} команду в приватном диалоге с ботом.`
      );
    }
    await StoreService.updateLastCommand(chatId, BOT_COMMANDS.NO_COMMAND);
  } else {
    return;
  }
});

//GROUP DATA PARSING
bot.on("my_chat_member", async (ctx) => {
  const isAdmin = ctx.new_chat_member.status === "administrator";

  const isDissmissedFromAdmin =
    ctx.old_chat_member.status === "administrator" &&
    ctx.new_chat_member.status !== "administrator";
  const chatId = await BotHelper.getChatIdByMessage(ctx);
  const currentGroup = await GroupController.getGroup(API_URL, chatId);
  const chatType = ctx.chat.type;

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
        "Получение данных...",
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
        "Получение данных...",
        DELAY_DELETE.AFTER_2_SEC
      );
      const { group_id } = currentGroup;
      const inviteLink = await BotHelper.getInviteLink(bot, chatId);
      await GroupController.updateGroupData(bot, API_URL, {
        group_id,
        group_link: inviteLink,
      });
    }
  } else {
    if (isDissmissedFromAdmin) {
      await GroupController.deleteGroup(API_URL, chatId);
    }
  }
});

//ADD NEW USERS TO COMMUNITY AUTOMATICALLY ON ADDING TO THE ANY CHATS
bot.on("new_chat_members", async (ctx) => {
  const newMembers = ctx.new_chat_members;

  const chatId = await BotHelper.getChatIdByMessage(ctx);

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
      await UserController.updateUserData(bot, API_URL, preparedData);
    } else {
      await UserController.addNewUser(bot, API_URL, preparedData, chatId);
    }
  });
});

//CHECK PROMOTIONS AND DISMISSING OF THE USERS
bot.on("chat_member", async (ctx) => {
  const isBot = ctx.from.is_bot;
  const isDissmissed =
    ctx?.old_chat_member?.status === "administrator" &&
    ctx?.new_chat_member?.status !== "administrator";
  const isPromoted =
    ctx?.old_chat_member?.status !== "administrator" &&
    ctx?.new_chat_member?.status === "administrator";
  if ((isDissmissed || isPromoted) && !isBot) {
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const groupAdmins = await BotHelper.getAdministrators(bot, chatId);
    const chatData = await BotHelper.getChatData(bot, chatId);
    await GroupController.updateGroupData(bot, API_URL, {
      group_id: chatData.id,
      group_admins_id: groupAdmins,
    });
  }
});

//REMOVE GROUP FROM USER GROUPS IF HE LEAVED GROUP
bot.on("left_chat_member", async (ctx) => {
  const kickedUser = ctx?.left_chat_participant ?? ctx?.left_chat_member;
  if (kickedUser.is_bot) {
    return;
  }
  const chatId = await BotHelper.getChatIdByMessage(ctx);
  const userId = kickedUser.id;
  const userFromDB = await UserController.getUser(API_URL, userId);
  if (userFromDB) {
    const preparedData = {
      user_id: userId,
      user_groups: userFromDB.user_groups.filter(
        (group) => group !== chatId.toString()
      ),
    };

    await UserController.updateUserData(bot, API_URL, preparedData);
  }
});

//OPEN APP
bot.onText(/\/open_app/, async (ctx) => {
  if (ctx.text === "/open_app" || ctx.text === `/open_app@${BOT_NAME}`) {
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const commandMsgId = await BotHelper.getMsgId(ctx);
    const isPrivate = await BotHelper.isChatPrivate(ctx);
    const userId = await BotHelper.getUserIdByMessage(ctx);

    const { current_state: isProcessing, last_command: lastCommand } =
      await StoreService.getStoreState(chatId);

    if (isProcessing) {
      await BotHelper.send(
        bot,
        chatId,
        `Завершите предыдущую операцию перед выполнением этой команды.\nПредыдущая операция была: ${lastCommand}`
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
          .sendMessage(chatId, "Добро пожаловать!", {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Открыть приложение",
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
          `Прежде чем получить доступ к пространству сообщества необходимо:\n1)Вызвать команду ${BOT_COMMANDS.ADD_USER} в любой группе этого сообщества где данный бот является администратором\n2)Авторизоваться в пространстве сообщества, вызвав команду ${BOT_COMMANDS.SPACE_LOGIN} в этом чате. Это предоставит вам полный доступ к пространству сообщества в котором вы состоите.\n\n Желаем удачи! ❤️`
        );
      }
    } else {
      await BotHelper.send(
        bot,
        userId,
        `Приветствую!\nВы можете получить доступ к пространству сообщества, если вы зарегистрировались и авторизовались в сообществе. Как это сделать:\n1)Вызвать команду ${BOT_COMMANDS.ADD_USER} в любой группе этого сообщества, где данный бот является администратором\n2)Авторизоваться в пространстве сообщества, вызвав команду ${BOT_COMMANDS.SPACE_LOGIN} в этом чате. Это предоставит вам полный доступ к пространству сообщества в котором вы состоите.\n3)После этого вызовите команду${BOT_COMMANDS.OPEN_APP} чтобы получить ваш персональный линк для доступа к вашему пространству.\n\nЖелаем удачи ❤️ `
      );
    }

    await StoreService.updateLastCommand(chatId, BOT_COMMANDS.NO_COMMAND);
  } else {
    return;
  }
});

//HELP COMMAND
bot.onText(/\/help/, async (ctx) => {
  if (ctx.text === "/help" || ctx.text === `/help@${BOT_NAME}`) {
    const isPrivate = await BotHelper.isChatPrivate(ctx);
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const msgId = await BotHelper.getMsgId(ctx);

    await BotHelper.deleteMessage(
      bot,
      chatId,
      isPrivate,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );

    const helpText = `/help - Показать все доступные команды\n/space_create - Создать пространство вашего сообщества\n/add - Зарегистрироваться в сообществе (работает в группах)\n/delete — Удалить данные профиля или удалиться из пространства сообщества\n/space_login - Авторизоваться в пространстве сообщества\n/open_app - Получить персональную ссылку для доступа в приложение\n\nЕсли вы владелец сообщества вы можете отправлять боту файлы которые вы хотите разместить в пространстве сообщества. Просто отправьте любой документ/видео/аудиофайл и т.д. боту в личном чате.`;

    if (isPrivate) {
      await BotHelper.send(bot, chatId, helpText);
    }
  } else {
    return;
  }
});

bot.on("channel_post", async (ctx) => {
  if (ctx.text && ctx.text.includes("#")) {
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const msgText = ctx.text;
    const userName = ctx.author_signature ?? "Участник сообщества";
    const link = await BotHelper.getMsgLink(ctx);
    const msgId = await BotHelper.getMsgId(ctx);
    const tags = await BotHelper.extractHashtags(ctx.text);
    const date = await BotHelper.getMsgDate(ctx);

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

bot.on("edited_channel_post", async (ctx) => {
  if (ctx.text && ctx.text.includes("#")) {
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const msgText = ctx.text;
    const userName = ctx.author_signature ?? "Участник сообщества";
    const link = await BotHelper.getMsgLink(ctx);
    const msgId = await BotHelper.getMsgId(ctx);
    const tags = await BotHelper.extractHashtags(ctx.text);
    const date = await BotHelper.getMsgDate(ctx);

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
bot.on("message", async (ctx) => {
  const isFromBot = await BotHelper.checkIsFromBot(ctx);
  const isPrivate = await BotHelper.isChatPrivate(ctx);
  const isCommand = ctx.pinned_message
    ? ctx?.pinned_message?.text.startsWith("/")
    : ctx?.text?.startsWith("/");
  const isPinnedMessage = ctx?.pinned_message;
  const chatId = await BotHelper.getChatIdByMessage(ctx);
  const { current_state: currentState, community_data } =
    await StoreService.getStoreState(chatId);

  // Create space name
  if (
    currentState === BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_INIT &&
    !isCommand &&
    !isPinnedMessage
  ) {
    if (!community_data.name) {
      await StoreService.updateCommunityName(chatId, ctx.text);
      await StoreService.updateCurrentState(
        chatId,
        BOT_STATE_MANAGER_MAPPING.SPACE_EDIT_NAME
      );
      await StoreService.updateLastCommand(chatId, BOT_COMMANDS.SPACE_CREATE);

      await BotHelper.send(bot, chatId, "Укажите описание сообщества: ");
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
      await StoreService.updateCommunityDescription(chatId, ctx.text);
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
              text: "✅ Да",
              callback_data: "correct_space_information",
            },
            {
              text: "🚫 Нет",
              callback_data: "incorrect_space_information",
            },
          ],
        ],
      };
      bot.sendMessage(
        chatId,
        `Название сообщества: ${space.name}\nОписание сообщества: ${space.description}\n\nИнформация верна?`,
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
    ctx.text &&
    ctx?.text?.includes("#")
  ) {
    const msgText = ctx.text;
    const userName = `${ctx?.from?.first_name ?? ""} ${
      ctx?.from?.last_name ?? ""
    }`;
    const userId = await BotHelper.getUserIdByMessage(ctx);
    const link = await BotHelper.getMsgLink(ctx);
    const msgId = await BotHelper.getMsgId(ctx);
    const tags = await BotHelper.extractHashtags(ctx.text);
    const date = await BotHelper.getMsgDate(ctx);
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

bot.on("edited_message", async (ctx) => {
  const isPrivate = await BotHelper.isChatPrivate(ctx);
  const isCommand = ctx.pinned_message
    ? ctx?.pinned_message?.text.startsWith("/")
    : ctx?.text?.startsWith("/");
  const isPinnedMessage = ctx?.pinned_message;

  if (
    !isPrivate &&
    !isCommand &&
    !isPinnedMessage &&
    ctx.text &&
    ctx?.text?.includes("#")
  ) {
    const chatId = await BotHelper.getChatIdByMessage(ctx);
    const msgText = ctx.text;
    const userName = `${ctx?.from?.first_name ?? ""} ${
      ctx?.from?.last_name ?? ""
    }`;
    const userId = await BotHelper.getUserIdByMessage(ctx);
    const link = await BotHelper.getMsgLink(ctx);
    const msgId = await BotHelper.getMsgId(ctx);
    const tags = await BotHelper.extractHashtags(ctx.text);
    const date = await BotHelper.getMsgDate(ctx);
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

  let callBackData;
  try {
    callBackData = JSON.parse(query.data);
  } catch (error) {
    callBackData = query.data;
  }

  if (callBackData === "accept_event") {
    const exctractedId = await EventService.extractEventid(query.message.text);
    if (exctractedId && exctractedId.length) {
      const id = exctractedId[0];
      const updatedEvent = await EventController.updateEvent(API_URL, id);
      if (updatedEvent) {
        bot.answerCallbackQuery(query.id, {
          text: `Событие опубликовано в пространстве сообщества`,
        });
      } else {
        bot.answerCallbackQuery(query.id, {
          text: `Такого события больше не существует`,
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
  } else if (callBackData === "decline_event") {
    const exctractedId = await EventService.extractEventid(query.message.text);
    if (exctractedId && exctractedId.length) {
      const id = exctractedId[0];
      const deletedEvent = await EventController.deleteEvent(API_URL, id);
      if (deletedEvent) {
        bot.answerCallbackQuery(query.id, {
          text: `Событие отклонено администратором и удалено`,
        });
      } else {
        bot.answerCallbackQuery(query.id, {
          text: `Событие уже удалено`,
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

  if (callBackData === "correct_space_information") {
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
        text: `Ваше пространство сообщества "${data.name}" успешно создано!`,
      });
    } else {
      const { spaceId, spaceOwner } = space;
      await StoreService.updateCommunityId(chatId, spaceId);
      const { community_data: data } = await StoreService.getStoreState(chatId);
      const preparedData = await SpaceService.formatData(data, spaceOwner);
      await SpaceController.updateSpaceData(bot, API_URL, preparedData, chatId);
      bot.answerCallbackQuery(query.id, {
        text: `Ваше пространство сообщества "${data.name}" было успешно обновлено!`,
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
  } else if (callBackData === "incorrect_space_information") {
    bot.editMessageText(
      `Если хотите повторить операцию создания пространства сообщества, вызовите команду: ${BOT_COMMANDS.SPACE_CREATE}.`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
      }
    );

    bot.answerCallbackQuery(query.id, {
      text: "Сообщество не было создано. Попробуйте еще раз.",
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

  if (callBackData === "edit_community_data") {
    await StoreService.updateCurrentState(
      chatId,
      BOT_STATE_MANAGER_MAPPING.CREATE_SPACE_INIT
    );
    await BotHelper.send(bot, chatId, "Укажите новое имя для сообщества: ");
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
  } else if (callBackData === "delete_community") {
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🔪 УДАЛИТЬ",
            callback_data: "delete_space_forever",
          },
          {
            text: "🚫 ОТМЕНА",
            callback_data: "cancel_space_delete",
          },
        ],
      ],
    };
    await BotHelper.send(
      bot,
      chatId,
      `ВЫ ТОЧНО УВЕРЕНЫ ЧТО ХОТИТЕ УДАЛИТЬ СООБЩЕСТВО?\n\n*Эту операцию нельзя отменить...`,
      {
        reply_markup: inlineKeyboard,
      }
    );
  }

  if (callBackData === "delete_space_forever") {
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
    await SpaceController.deleteSpace(bot, API_URL, chatId, chatId);
    bot.answerCallbackQuery(query.id, {
      text: "Пространство сообщества было удалено",
    });
  } else if (
    callBackData === "cancel_space_delete" ||
    callBackData === "cancel_space_create"
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
      "Пространство сообщества не было удалено. Вы можете снова получить персональную ссылку отправив команду:\n/open_app\nдля управления и доступа пространством сообщества",
      DELAY_DELETE.AFTER_2_SEC
    );
  }

  if (callBackData === "upload_file") {
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
  } else if (callBackData === "cancel_upload") {
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

  if (callBackData?.command === "delete_from_space") {
    const user = await UserController.getUser(API_URL, userId);

    if (user && user.user_spaces.length) {
      const { space_id: spaceIdForDeleting } = callBackData.data;

      const spaceForDeleting = await SpaceController.getSpace(
        API_URL,
        spaceIdForDeleting
      );

      if (spaceForDeleting && spaceForDeleting?.spaceGroups?.length) {
        const { spaceGroups, spaceName } = spaceForDeleting;
        const spaceGroupsId = spaceGroups.map((group) => group.groupId);

        const filteredGroups = user.user_groups.filter(
          (groupId) => !spaceGroupsId.includes(groupId)
        );

        const preparedData = {
          user_id: user.user_id,
          user_groups: filteredGroups,
          user_spaces: user.user_spaces.filter(
            (spaceId) => spaceId !== spaceIdForDeleting
          ),
        };

        await UserController.updateUserData(bot, API_URL, preparedData).then(
          () => {
            bot.answerCallbackQuery(query.id, {
              text: `Вы покинули пространство сообщества "${spaceName}"`,
            });
          }
        );
      } else {
        bot.answerCallbackQuery(query.id, {
          text: `Такого сообщества больше не существует...`,
        });
      }
    } else {
      bot.answerCallbackQuery(query.id, {
        text: `Вы не состоите ни в одном сообществе`,
      });
    }

    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );
  } else if (callBackData === "delete_user_profile") {
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🔪 УДАЛИТЬ",
            callback_data: "delete_user_forever",
          },
          {
            text: "🚫 ОТМЕНА",
            callback_data: "cancel_user_delete",
          },
        ],
      ],
    };
    await BotHelper.send(
      bot,
      chatId,
      `ВЫ ТОЧНО УВЕРЕНЫ ЧТО ХОТИТЕ УДАЛИТЬ СВОЙ ПРОФИЛЬ?\n*Эта операция необратима`,
      {
        reply_markup: inlineKeyboard,
      }
    );
  }

  if (callBackData === "delete_user_forever") {
    await UserController.deleteUserData(bot, API_URL, userId).then(() => {
      bot.answerCallbackQuery(query.id, {
        text: `Ваш профиль успешно удалён`,
      });
    });

    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );
  } else if (callBackData === "cancel_user_delete") {
    await BotHelper.deleteMessage(
      bot,
      chatId,
      true,
      msgId,
      DELAY_DELETE.IMMEDIATELY
    );

    await BotHelper.sendDelete(
      bot,
      chatId,
      "Ваш профиль остался неизменным. Спасибо что решили остаться с нами! ❤️",
      DELAY_DELETE.AFTER_2_SEC
    );
  }
});

bot.on("audio", async (ctx) => {
  const isPrivate = await BotHelper.isChatPrivate(ctx);
  const chatId = await BotHelper.getChatIdByMessage(ctx);
  const msgId = await BotHelper.getMsgId(ctx);

  if (isPrivate) {
    const space = await SpaceController.getSpace(API_URL, chatId);
    if (!space) {
      await BotHelper.send(
        bot,
        chatId,
        `У вас нет сообщества, куда можно было бы подгрузить этот аудиофайл\nЕсли вы хотите создать пространство сообщества, запустите команду: \n${BOT_COMMANDS.SPACE_CREATE}`
      );
      return;
    } else {
      const { current_state: state } = await StoreService.getStoreState(chatId);

      const { spaceName, spaceId } = space;
      const file = ctx?.audio ?? null;

      if (state) {
        await BotHelper.send(
          bot,
          chatId,
          `Завершите предыдущую загрузку, прежде чем посылать новый файл.`
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
                text: "☁️ ЗАГРУЗИТЬ",
                callback_data: "upload_file",
              },
              {
                text: "🚫 ОТМЕНА",
                callback_data: "cancel_upload",
              },
            ],
          ],
        };

        await BotHelper.sendDelete(
          bot,
          chatId,
          "Айдиофайл обрабатывается...",
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
          `Вы хотите добавить аудиофайл ${file.file_name} в "${spaceName}" пространство?`,
          {
            reply_markup: inlineKeyboard,
          }
        );
      }
    }
  }
});

bot.on("document", async (ctx) => {
  const isPrivate = await BotHelper.isChatPrivate(ctx);
  const chatId = await BotHelper.getChatIdByMessage(ctx);
  const msgId = await BotHelper.getMsgId(ctx);

  if (isPrivate) {
    const space = await SpaceController.getSpace(API_URL, chatId);
    if (!space) {
      await BotHelper.send(
        bot,
        chatId,
        `У вас нет сообщества, куда можно было бы подгрузить файл\nЕсли вы хотите создать пространство сообщества, запустите команду: \n${BOT_COMMANDS.SPACE_CREATE}`
      );
      return;
    } else {
      const { current_state: state } = await StoreService.getStoreState(chatId);

      const { spaceName, spaceId } = space;
      const file = ctx?.document ?? null;

      if (state) {
        await BotHelper.send(
          bot,
          chatId,
          `Завершите предыдущую загрузку, прежде чем посылать новый файл.`
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
                text: "☁️ ЗАГРУЗИТЬ",
                callback_data: "upload_file",
              },
              {
                text: "🚫 ОТМЕНА",
                callback_data: "cancel_upload",
              },
            ],
          ],
        };

        await BotHelper.sendDelete(
          bot,
          chatId,
          "Документ обрабатывается...",
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
          `Вы хотите добавить файл ${file.file_name} в "${spaceName}" пространство?`,
          {
            reply_markup: inlineKeyboard,
          }
        );
      }
    }
  }
});

bot.on("video", async (ctx) => {
  const isPrivate = await BotHelper.isChatPrivate(ctx);
  const chatId = await BotHelper.getChatIdByMessage(ctx);
  const msgId = await BotHelper.getMsgId(ctx);

  if (isPrivate) {
    const space = await SpaceController.getSpace(API_URL, chatId);
    if (!space) {
      await BotHelper.send(
        bot,
        chatId,
        `У вас нет сообщества, куда можно было бы подгрузить это видео\nЕсли вы хотите создать пространство сообщества, запустите команду: \n${BOT_COMMANDS.SPACE_CREATE}`
      );
      return;
    } else {
      const { current_state: state } = await StoreService.getStoreState(chatId);

      const { spaceName, spaceId } = space;
      const file = ctx?.video ?? null;

      if (state) {
        await BotHelper.send(
          bot,
          chatId,
          `Завершите предыдущую загрузку, прежде чем посылать новый файл.`
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
                text: "☁️ ЗАГРУЗИТЬ",
                callback_data: "upload_file",
              },
              {
                text: "🚫 ОТМЕНА",
                callback_data: "cancel_upload",
              },
            ],
          ],
        };

        await BotHelper.sendDelete(
          bot,
          chatId,
          "Видео обрабатывается...",
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
          `Вы хотите добавить видео ${file.file_name} в "${spaceName}" пространство?`,
          {
            reply_markup: inlineKeyboard,
          }
        );
      }
    }
  }
});
