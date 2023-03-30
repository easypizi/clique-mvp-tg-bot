class BotHelper {
  async getChatIdByMessage(msg) {
    return msg?.chat.id;
  }

  async getUserIdByMessage(msg) {
    return msg?.from.id;
  }

  async getMsgId(msg) {
    return msg?.message_id;
  }

  async isChatPrivate(msg) {
    return msg?.chat?.type === "private";
  }

  async getChatData(bot, chatId) {
    try {
      const result = await bot.getChat(chatId);
      return result;
    } catch (error) {
      await bot.sendMessage(
        chatId,
        "Sorry, an error occurred during parsing of group's data"
      );
    }
  }

  async getInviteLink(bot, chatId) {
    try {
      const result = await bot.exportChatInviteLink(chatId);
      return result;
    } catch (e) {
      console.log(e);
    }
  }

  async getAdministrators(bot, chatId) {
    try {
      const result = await bot.getChatAdministrators(chatId);
      const filteredResult = result.filter((data) => !data.user.is_bot);
      return filteredResult.map((data) => data.user.id);
    } catch (e) {
      await bot.sendMessage(
        chatId,
        "Sorry, an error occurred during parsing of group's admins data"
      );
    }
  }

  async checkBotRights(bot, chatId) {
    return bot
      .getChatAdministrators(chatId)
      .then((admins) => {
        const botId = bot.token.match(/^[^:]+/)[0];
        const botData = admins
          .filter((admin) => admin.user.id.toString() === botId.toString())
          .shift();
        if (botData) {
          const result = Object.keys(botData).reduce((acc, key) => {
            if (key.startsWith("can_")) {
              acc[key] = botData[key];
            }
            return acc;
          }, {});

          return result;
        } else {
          return null;
        }
      })
      .catch((error) => {
        console.log("Error:", error);
      });
  }

  async send(bot, chatId, message, options) {
    bot.sendMessage(chatId, message, options);
  }

  async sendDelete(bot, chatId, message, delay) {
    bot.sendMessage(chatId, message).then((sentMsg) => {
      setTimeout(() => {
        bot.deleteMessage(chatId, sentMsg.message_id);
      }, delay);
    });
  }

  async deleteMessage(bot, chatId, isPrivateChat, msgId, delay) {
    try {
      const isBotAvailable = !isPrivateChat
        ? await this.checkBotRights(bot, chatId)
        : {
            can_delete_messages: true,
          };

      if (isBotAvailable && isBotAvailable.can_delete_messages) {
        setTimeout(() => {
          bot.deleteMessage(chatId, msgId);
        }, delay);
      } else {
        bot.sendMessage(
          chatId,
          "Bot doesn't have all admin rights to manage this chat. Please provide all rights to the bot and delete this message manually."
        );
      }
    } catch (e) {
      console.log(e);
    }
  }
}

export default new BotHelper();
