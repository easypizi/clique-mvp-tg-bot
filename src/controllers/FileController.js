import request from "request";
import BotHelper from "../helpers/BotHelper.js";

import { DELAY_DELETE } from "../const.js";

class FileController {
  async prepareURLToBuffer(fileUrl) {
    if (!fileUrl) {
      throw new Error("Can not download file without fileUrl");
    }

    try {
      return new Promise((resolve, reject) => {
        request.get(
          { url: fileUrl, encoding: null },
          async function (error, response, body) {
            if (!error && response.statusCode == 200) {
              const fileBuffer = Buffer.from(body);
              resolve(fileBuffer);
            } else {
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async uploadFile(bot, api_url, preparedData, chatId) {
    if (!preparedData.space_id || !preparedData.file_url) {
      throw new Error("Can not upload file without space or file");
    }

    try {
      const upload_endpoint = `${api_url}/upload-file-by-url`;
      request.post(
        upload_endpoint,
        {
          json: preparedData,
        },
        (error, response, body) => {
          if (!error && response.statusCode == 200) {
            BotHelper.sendDelete(
              bot,
              chatId,
              `Файл ${preparedData.file_name} был успешно добавлен в ваше сообщество!`,
              DELAY_DELETE.AFTER_2_SEC
            );
          } else {
            BotHelper.sendDelete(
              bot,
              chatId,
              body?.message ??
                "Произошла ошибка, попробуйте повторить операцию позже",
              DELAY_DELETE.AFTER_2_SEC
            );
          }
        }
      );
    } catch (error) {
      console.error("Error during creating new user: " + error?.message);
      throw new Error(error?.message);
    }
  }
}

export default new FileController();
