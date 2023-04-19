import request from "request";
import BotHelper from "../helpers/BotHelper.js";

import { DELAY_DELETE } from "../const.js";

class FileController {
  async prepareURLToBuffer(fileUrl, mimeType) {
    if (!fileUrl) {
      throw new Error("Can not download file without fileUrl");
    }

    try {
      return new Promise((resolve, reject) => {
        request.get(fileUrl, async function (error, response, body) {
          if (!error && response.statusCode == 200) {
            const fileBuffer = Buffer.from(body, mimeType);
            resolve(fileBuffer);
          } else {
            reject(error);
          }
        });
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
              `File ${preparedData.file_name} was succesfully uploaded to your space!`,
              DELAY_DELETE.AFTER_2_SEC
            );
          } else {
            BotHelper.sendDelete(
              bot,
              chatId,
              body?.message ?? "Something went wrong, try again later",
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
