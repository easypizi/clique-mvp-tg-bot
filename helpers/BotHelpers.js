class BotHelper {
  async send(bot, chatId, message, options) {
    bot.sendMessage(chatId, message, ...options);
  }

  async sendDelete(bot, chatId, message, delay) {
    bot.sendMessage(chatId, message).then((sentMsg) => {
      setTimeout(() => {
        bot.deleteMessage(chatId, sentMsg.message_id);
      }, delay);
    });
  }
}

export default new BotHelper();
