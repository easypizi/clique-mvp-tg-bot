import request from "request";
import BotHelper from "../helpers/BotHelper.js";
import { BOT_COMMANDS, DELAY_DELETE } from "../const.js";

class UserController {
  async addNewUser(bot, api_url, preparedData, chatId) {
    if (preparedData.user_id) {
      try {
        const create_endpoint = `${api_url}/create-user`;
        request.post(
          create_endpoint,
          { json: preparedData },
          (error, response, body) => {
            if (!error && response.statusCode == 200) {
              BotHelper.sendDelete(
                bot,
                chatId,
                `Пользователь "@${preparedData.user_telegram_link}" зарегистрирован`,
                DELAY_DELETE.AFTER_2_SEC
              );
            } else {
              BotHelper.sendDelete(
                bot,
                chatId,
                body?.message ?? "Что-то пошло не так, повторите попытку позже",
                DELAY_DELETE.AFTER_2_SEC
              );
            }
          }
        );
      } catch (error) {
        console.error("Error during creating new user");
      }
    }
  }

  async getUser(api_url, userId) {
    const get_user_endpoint = `${api_url}/user/${userId}`;

    return new Promise((resolve, reject) => {
      request.get(get_user_endpoint, (error, response, body) => {
        if (error) {
          reject(error);
        } else if (response.statusCode !== 200) {
          reject(new Error(`Unexpected status code: ${response.statusCode}`));
        } else {
          const data = JSON.parse(body);
          if (data && data.length > 0) {
            resolve(data[0]);
          } else {
            resolve(null);
          }
        }
      });
    });
  }

  async deleteUserData(bot, api_url, userId) {
    if (userId) {
      try {
        const delete_endpoint = `${api_url}/delete-user/${userId}`;
        request.delete(delete_endpoint);
      } catch (error) {
        console.error("Error during deleting group data");
      }
    }
  }

  async updateUserData(bot, api_url, preparedData, chatId) {
    if (preparedData.user_id) {
      try {
        const update_endpoint = `${api_url}/update-user`;
        request.patch(
          update_endpoint,
          { json: preparedData },
          (error, response, body) => {
            if (chatId) {
              if (!error && response.statusCode == 200) {
                BotHelper.sendDelete(
                  bot,
                  chatId,
                  `Вы успешно авторизовались! \nТеперь вы можете вызвать команду ${BOT_COMMANDS.OPEN_APP}, чтобы получить персональную ссылку на приложение`,
                  DELAY_DELETE.AFTER_5_SEC
                );
              } else {
                BotHelper.sendDelete(
                  bot,
                  chatId,
                  body?.message ??
                    "Что-то пошло не так, повторите попытку позже",
                  DELAY_DELETE.AFTER_2_SEC
                );
              }
            }
          }
        );
      } catch (error) {
        console.error("Error during updating user data");
      }
    }
  }
}

export default new UserController();
