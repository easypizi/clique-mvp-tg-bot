class GroupService {
  async formatData({ id, name, link, admins, type }) {
    return {
      group_id: id,
      group_link: link,
      group_name: name,
      group_admins_id: [...admins],
      group_type: type,
    };
  }
}

export default new GroupService();
