import request from "request";
import BotHelper from "../helpers/BotHelper.js";

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
                `User ${preparedData.user_telegram_link} succesfully added!`,
                2000
              );
            } else {
              BotHelper.sendDelete(
                bot,
                chatId,
                body?.message ?? "Something went wrong, try again later",
                2000
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
          if (data.length > 0) {
            resolve(data);
          }
        }
      });
    });
  }

  async checkUserExistence(api_url, userId) {
    const get_user_endpoint = `${api_url}/user/${userId}`;

    return new Promise((resolve, reject) => {
      request.get(get_user_endpoint, (error, response, body) => {
        if (error) {
          reject(error);
        } else if (response.statusCode !== 200) {
          reject(new Error(`Unexpected status code: ${response.statusCode}`));
        } else {
          const data = JSON.parse(body);
          if (data.length > 0) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
    });
  }

  async UpdateUserData(bot, api_url, preparedData, chatId) {
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
                  `User ${preparedData.user_telegram_link} data succesfully updated!`,
                  2000
                );
              } else {
                BotHelper.sendDelete(
                  bot,
                  chatId,
                  body?.message ?? "Something went wrong, try again later",
                  2000
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
