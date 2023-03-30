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
            if (data.length > 0) {
              resolve(data[0]);
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
                `Space ${preparedData.space_name} succesfully added!`,
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
        console.error("Error during creating new space");
      }
    }
  }

  async UpdateSpaceData(bot, api_url, preparedData, chatId) {
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
                  `Space ${preparedData.space_name} was succesfully updated!`,
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
        console.error("Error during updating space data");
      }
    }
  }

  async DeleteSpace(bot, api_url, space_id, chatId) {
    if (space_id) {
      try {
        const delete_endpoint = `${api_url}/delete-space/${space_id}`;
        request.delete(delete_endpoint, {}, (error, response, body) => {
          const { data } = JSON.parse(body);

          if (data) {
            BotHelper.send(
              bot,
              chatId,
              `Space ${data.space_name} was succesfully deleted! SOOO SAD :(`
            );
          } else {
            BotHelper.send(
              bot,
              chatId,
              `This space was already deleted! If it was made without your attention please connect with Clique team`
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
