class GroupService {
  async formatData({ id, name, link, admins }) {
    return {
      group_id: id,
      group_link: link,
      group_name: name,
      group_admins_id: [...admins],
    };
  }
}

export default new GroupService();
