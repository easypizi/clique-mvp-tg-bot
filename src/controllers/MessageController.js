import request from "request";

class MessageController {
  async createMessage(api_url, preparedData) {
    try {
      const create_endpoint = `${api_url}/create-message`;
      request.post(create_endpoint, { json: preparedData });
    } catch (error) {
      console.error(
        `Error during creating new message in DB. Error message: ${error}`
      );
    }
  }

  async updateMessage(api_url, preparedData) {
    try {
      const update_endpoint = `${api_url}/update-message`;
      request.patch(update_endpoint, { json: preparedData });
    } catch (error) {
      console.error(
        `Error during updating new message in DB. Error message: ${error}`
      );
    }
  }
}

export default new MessageController();
