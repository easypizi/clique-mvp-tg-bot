import request from "request";

class EventController {
  async updateEvent(api_url, id) {
    try {
      return new Promise((resolve, reject) => {
        const update_endpoint = `${api_url}/update-event`;
        const updateData = {
          event_id: id,
          event_is_verified: true,
        };
        request.patch(
          update_endpoint,
          { json: updateData },
          (error, response, body) => {
            if (error) {
              reject(error);
            } else if (response.statusCode !== 200) {
              reject(
                new Error(`Unexpected status code: ${response.statusCode}`)
              );
            } else {
              const data = JSON.parse(body);
              console.log(data);
              // resolve(data);
            }
          }
        );
      });
    } catch (error) {
      console.error(
        `Error during updating event in DB. Error message: ${error}`
      );
    }
  }

  async deleteEvent(api_url, id) {
    try {
      return new Promise((resolve, reject) => {
        const delete_endpoint = `${api_url}/delete-event/${id}`;
        request.delete(delete_endpoint, (error, response, body) => {
          if (error) {
            reject(error);
          } else if (response.statusCode !== 200) {
            reject(new Error(`Unexpected status code: ${response.statusCode}`));
          } else {
            const data = JSON.parse(body);
            console.log(data);
            // resolve(data);
          }
        });
      });
    } catch (error) {
      console.error(
        `Error during deleting event in DB. Error message: ${error}`
      );
    }
  }
}

export default new EventController();
