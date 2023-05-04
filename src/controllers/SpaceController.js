import request from "request";
import BotHelper from "../helpers/BotHelper.js";

class SpaceController {
  async getSpace(api_url, spaceId) {
    try {
      const get_space_endpoint = `${api_url}/space/${spaceId}`;
      return new Promise((resolve, reject) => {
        request.get(get_space_endpoint, (error, response, body) => {
          if (error) {
            reject(error);
          } else if (response.statusCode !== 200) {
            reject(new Error(`Unexpected status code: ${response.statusCode}`));
          } else {
            const data = JSON.parse(body);
            if (data) {
              resolve(data);
            } else {
              resolve(null);
            }
          }
        });
      });
    } catch (error) {
      console.log(`Error during parsing data from space DB on API`);
    }
  }

  async getUserSpacesByQueryId(api_url, spacesIdString) {
    try {
      const get_user_spaces_endpoint = `${api_url}/user-spaces?id=${spacesIdString}`;

      return new Promise((resolve, reject) => {
        request.get(get_user_spaces_endpoint, (error, response, body) => {
          if (error) {
            reject(error);
          } else if (response.statusCode !== 200) {
            reject(new Error(`Unexpected status code: ${response.statusCode}`));
          } else {
            const data = JSON.parse(body);
            if (data && data.length) {
              resolve(data);
            } else {
              resolve(null);
            }
          }
        });
      });
    } catch (error) {
      console.log(`Error during parsing user spaces from DB on API`);
    }
  }

  async addNewSpace(bot, api_url, preparedData, chatId) {
    if (preparedData.space_id) {
      try {
        const create_endpoint = `${api_url}/create-space`;
        request.post(
          create_endpoint,
          { json: preparedData },
          (error, response, body) => {
            if (!error && response.statusCode == 200) {
              BotHelper.sendDelete(
                bot,
                chatId,
                `Пространство "${preparedData.space_name}" успешно создано!`,
                2000
              );
            } else {
              BotHelper.sendDelete(
                bot,
                chatId,
                body?.message ??
                  "Что-то пошло не так, попробуйте повторить операцию позже",
                2000
              );
            }
          }
        );
      } catch (error) {
        console.error("Error during creating new space");
      }
    }
  }

  async updateSpaceData(bot, api_url, preparedData, chatId) {
    if (preparedData.space_id) {
      try {
        const update_endpoint = `${api_url}/update-space`;
        request.patch(
          update_endpoint,
          { json: preparedData },
          (error, response, body) => {
            if (chatId) {
              if (!error && response.statusCode == 200) {
                BotHelper.sendDelete(
                  bot,
                  chatId,
                  `Информация о пространстве "${preparedData.space_name}" была успешна обновлена`,
                  2000
                );
              } else {
                BotHelper.sendDelete(
                  bot,
                  chatId,
                  body?.message ??
                    "Что-то пошло не так, попробуйте повторить операцию позже",
                  2000
                );
              }
            }
          }
        );
      } catch (error) {
        console.error("Error during updating space data");
      }
    }
  }

  async deleteSpace(bot, api_url, space_id, chatId) {
    if (space_id) {
      try {
        const delete_endpoint = `${api_url}/delete-space/${space_id}`;
        request.delete(delete_endpoint, {}, (error, response, body) => {
          const { data } = JSON.parse(body);

          if (data) {
            BotHelper.send(
              bot,
              chatId,
              `Пространство "${data.space_name}" было удалено.`
            );
          } else {
            BotHelper.send(
              bot,
              chatId,
              `Такого пространства не существует. Если вы считаете что это произошло по ошибке - напишите в саппорт чат (ссылка в описании бота).`
            );
          }
        });
      } catch (error) {
        console.log("Error during deleting space data");
      }
    }
  }
}

export default new SpaceController();
