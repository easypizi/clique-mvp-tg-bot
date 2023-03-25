import request from 'request';
import BotHelpers from '../helpers/BotHelpers.js';

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
              BotHelpers.sendDelete(
                bot,
                chatId,
                `Пользователь ${preparedData.user_telegram_link} добавлен в базу данных сообщества`,
                2000
              );
            } else {
              BotHelpers.sendDelete(
                bot,
                chatId,
                body?.message ?? 'Something went wrong, try again later',
                2000
              );

              console.log(error);
              console.log(response);
            }
          }
        );
      } catch (error) {
        console.error('Error during sending Data to API');
      }
    }
  }
}

export default new UserController();
