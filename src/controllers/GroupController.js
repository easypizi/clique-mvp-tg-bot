import request from "request";
import BotHelper from "../helpers/BotHelper.js";

class GroupController {
  async addNewGroup(bot, api_url, preparedData, chatId) {
    if (preparedData.group_id) {
      try {
        const create_endpoint = `${api_url}/create-group`;
        request.post(
          create_endpoint,
          { json: preparedData },
          (error, response, body) => {
            if (!error && response.statusCode == 200) {
              BotHelper.sendDelete(
                bot,
                chatId,
                `Group ${preparedData.group_name} succesfully added to db!`,
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
      } catch (e) {
        console.log("Error during creating new Group object in database");
      }
    }
  }

  async updateGroupData(bot, api_url, preparedData, chatId) {
    if (preparedData.group_id) {
      try {
        const update_endpoint = `${api_url}/update-group`;
        request.patch(
          update_endpoint,
          { json: preparedData },
          (error, response, body) => {
            if (chatId) {
              if (!error && response.statusCode == 200) {
                BotHelper.sendDelete(
                  bot,
                  chatId,
                  `Group ${preparedData.group_name} was succesfully updated!`,
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
        console.error("Error during updating group data");
      }
    }
  }

  async getGroup(api_url, groupId) {
    try {
      const get_group_endpoint = `${api_url}/group/${groupId}`;
      return new Promise((resolve, reject) => {
        request.get(get_group_endpoint, (error, response, body) => {
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
    } catch (error) {
      console.log(`Error during parsing data from Group DB on API`);
    }
  }

  async deleteGroup(api_url, groupId) {
    try {
      const delete_group_endpoint = `${api_url}/delete-group/${groupId}`;
      request.delete(delete_group_endpoint);
    } catch (error) {
      console.log(`Error during deleting group`);
    }
  }
}

export default new GroupController();
