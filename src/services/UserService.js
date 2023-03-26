class UserService {
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

  async getUserData(bot, chatId, userId) {
    try {
      const result = await bot.getChatMember(chatId, userId);
      return result.user;
    } catch (e) {
      await bot.sendMessage(
        chatId,
        'Sorry, an error occurred during parsing of user data'
      );
    }
  }

  async getUserProfilePhotos(bot, userId, chatId, token) {
    try {
      const userProfilePhotos = await bot.getUserProfilePhotos(userId);
      if (userProfilePhotos.total_count > 0) {
        const file = await bot.getFile(userProfilePhotos.photos[0][2].file_id);
        const photoUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        return photoUrl ?? '';
      } else {
        await bot
          .sendMessage(chatId, "User hasn't uploaded a profile photo")
          .then((sentMsg) => {
            setTimeout(() => {
              bot.deleteMessage(chatId, sentMsg.message_id);
            }, 500);
          });
      }
    } catch (error) {
      await bot.sendMessage(
        chatId,
        'Sorry, an error occurred during parsing of photo'
      );
    }
  }

  async formatData(
    { id, first_name, last_name, username },
    userPhotoLink,
    admins
  ) {
    return {
      user_id: id,
      user_name: first_name,
      user_last_name: last_name,
      user_telegram_link: username,
      is_admin: admins.includes(id),
      user_description: '',
      user_image: userPhotoLink ?? '',
    };
  }
}

export default new UserService();