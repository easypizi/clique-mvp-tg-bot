class MessageService {
  async formatData({
    chatId,
    link,
    msgId,
    tags,
    date,
    msgText,
    userName,
    userPhoto,
    userId,
  }) {
    return {
      message_id: msgId.toString(),
      message_group_id: chatId.toString(),
      message_date: date,
      message_text: msgText,
      message_tags: tags,
      message_link: link,
      message_user_photo: userPhoto ?? null,
      message_user_name: userName,
      message_user_id: userId?.toString() ?? null,
    };
  }
}

export default new MessageService();
