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
        const result = request.patch(update_endpoint, { json: updateData });
        console.log("///UPD///");
        console.log(JSON.parse(result).data);
        console.log("/////////");

        resolve(JSON.parse(result).data);
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
        const result = request.delete(delete_endpoint);
        console.log("///DEL///");
        console.log(JSON.parse(result).data);
        console.log("/////////");
        resolve(JSON.parse(result).data);
      });
    } catch (error) {
      console.error(
        `Error during deleting event in DB. Error message: ${error}`
      );
    }
  }
}

export default new EventController();
