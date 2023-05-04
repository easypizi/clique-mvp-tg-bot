import { DELAY_DELETE } from "../const.js";
import BotHelper from "../helpers/BotHelper.js";

class UserService {
  async parseUserFromChat(bot, chatId, userId, userName) {
    try {
      const result = await bot.getChatMember(chatId, userId);
      return result.user;
    } catch (error) {
      await BotHelper.sendDelete(
        bot,
        chatId,
        `Не удаётся получить данные ${userName}.\nИзмените свои настройки приватности и попробуйте снова.`,
        DELAY_DELETE.AFTER_2_SEC
      );
      console.error(`Error during parsing user data. USER ID: ${userId}`);
    }
  }

  async getUserPhotoFromTg(bot, userId, token) {
    try {
      const userProfilePhotos = await bot.getUserProfilePhotos(userId);

      if (userProfilePhotos.total_count > 0) {
        const file = await bot.getFile(userProfilePhotos.photos[0][0].file_id);
        const photoUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        return photoUrl;
      } else {
        return null;
      }
    } catch (e) {
      console.error(`Error during getting photo of user. USER ID: ${userId}`);
    }
  }

  async parseUserProfilePhotosOnAdd(bot, userId, chatId, token, userName) {
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
          `Не удаётся получить фотографию профиля ${userName}.\nВы можете подгрузить любую аватарку внутри приложения.`,
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
    chatId,
    userFromDb
  ) {
    const userUpdateFields = {
      user_id: id,
      user_groups: userFromDb
        ? [...userFromDb.user_groups, chatId.toString()]
        : [chatId.toString()],
    };

    if (!userFromDb) {
      return {
        ...userUpdateFields,
        user_name: first_name,
        user_last_name: last_name,
        user_telegram_link: username,
        user_image: userPhotoLink,
        is_visible: true,
      };
    }

    if (first_name && !userFromDb["user_name"]) {
      userUpdateFields["user_name"] = first_name;
    }

    if (last_name && !userFromDb["user_last_name"]) {
      userUpdateFields["user_last_name"] = last_name;
    }

    if (username && !userFromDb["user_telegram_link"]) {
      userUpdateFields["user_telegram_link"] = username;
    }

    if (userPhotoLink && !userFromDb["user_image"]) {
      userUpdateFields["user_image"] = userPhotoLink;
    }

    return userUpdateFields;
  }
}

export default new UserService();
