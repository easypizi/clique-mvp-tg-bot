import { DELAY_DELETE } from "../const.js";
import BotHelper from "../helpers/BotHelper.js";

class UserService {
  async getUserData(bot, chatId, userId, userName) {
    try {
      const result = await bot.getChatMember(chatId, userId);
      return result.user;
    } catch (error) {
      await BotHelper.sendDelete(
        bot,
        chatId,
        `Can't parse ${userName} data.\nPlease check your privacy settings and try again.`,
        DELAY_DELETE.AFTER_2_SEC
      );
      console.error(`Error during parsing user data. USER ID: ${userId}`);
    }
  }

  async getUserProfilePhotos(bot, userId, chatId, token, userName) {
    try {
      const userProfilePhotos = await bot.getUserProfilePhotos(userId);
      if (userProfilePhotos.total_count > 0) {
        const file = await bot.getFile(userProfilePhotos.photos[0][2].file_id);
        const photoUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        return photoUrl;
      } else {
        await BotHelper.sendDelete(
          bot,
          chatId,
          `Bot can't get ${userName} profile photo.\nPlease check you privacy setting and update your information – sent command /add to this chat.`,
          DELAY_DELETE.AFTER_2_SEC
        );
      }
    } catch (error) {
      console.error(
        `Error during parsing of photo of user. USER ID: ${userId}`
      );
    }
  }

  async formatData(
    { id, first_name, last_name, username },
    userPhotoLink,
    chatId
  ) {
    return {
      user_id: id,
      user_name: first_name,
      user_last_name: last_name,
      user_telegram_link: username,
      user_image: userPhotoLink ?? "",
      user_groups: [chatId.toString()],
      is_visible: true,
    };
  }
}

export default new UserService();
