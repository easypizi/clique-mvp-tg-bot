class SpaceService {
  async formatData({ id, name, description }, userId) {
    return {
      space_id: id,
      space_name: name,
      space_description: description,
      space_owner_id: userId,
    };
  }
}

export default new SpaceService();
