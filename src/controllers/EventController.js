import request from "request";

class EventController {
  async updateEvent(api_url, id) {
    try {
      const update_endpoint = `${api_url}/update-event`;
      const updateData = {
        event_id: id,
        event_is_verified: true,
      };
      const result = request.patch(update_endpoint, { json: updateData });
      return result.data;
    } catch (error) {
      console.error(
        `Error during updating event in DB. Error message: ${error}`
      );
    }
  }

  async deleteEvent(api_url, id) {
    try {
      const delete_endpoint = `${api_url}/delete-event/${id}`;
      const result = request.delete(delete_endpoint);
      return result.data;
    } catch (error) {
      console.error(
        `Error during deleting event in DB. Error message: ${error}`
      );
    }
  }
}

export default new EventController();
