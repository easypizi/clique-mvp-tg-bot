class EventService {
  extractEventid(text) {
    const regex = /\|\|(.+?)\|\|/g;
    const matches = text.match(regex);
    if (matches === null) {
      return null;
    }
    const result = matches.map((match) => match.slice(2, -2));
    return result;
  }

  prepareTagsMarkdown(tags) {
    if (!tags || !tags.length) {
      return "";
    }

    return tags
      .replaceAll("#", "")
      .replaceAll(" ", "")
      .replaceAll("_", "\\_")
      .replaceAll("-", "\\_")
      .split(",")
      .map((tag) => `#${tag}`)
      .join(" ");
  }

  prepareAddressMarkdown({ country, city, address, geo }) {
    if (!country || !city || !address) {
      return "Локация неизвестна...";
    }

    const location = `${country}, ${city}, ${address}\n${
      geo.length ? "*ТОЧКА НА КАРТЕ:* " + `[Нажми сюда](${geo})` : ""
    }`;

    return location.replaceAll("_", "\\_");
  }

  prepareEventLinkMarkdown(link) {
    if (!link) {
      return null;
    }

    return `[Нажми сюда](${link})`;
  }

  prepareOrganizerMarkdown({
    event_organizer_credentials,
    event_organizer_telegram_link,
  }) {
    if (!event_organizer_credentials || !event_organizer_telegram_link) {
      return "Неизвестный организатор";
    }

    const result = `${event_organizer_credentials} ${event_organizer_telegram_link}`;

    return result.replaceAll("_", "\\_");
  }

  prepareDescription(description) {
    if (!description || !description.length) {
      return "";
    }

    return description.replaceAll("_", "\\_");
  }

  prepareEventMessageToAdminCheck(data) {
    if (!data) {
      return "";
    }

    const tags = this.prepareTagsMarkdown(data?.event_tags);
    const location = this.prepareAddressMarkdown(data.event_location);
    const linkToEvent = this.prepareEventLinkMarkdown(data.event_link);
    const organizer = this.prepareOrganizerMarkdown(data);
    const description = this.prepareDescription(data.event_description);

    const eventAgendaMessage = `||${
      data.event_id
    }||\n\n${organizer} предлагает опубликовать данное мероприятие:\n\n*${
      data.event_name
    }*\n\n${description}\n\n*ДАТА и ВРЕМЯ:* ${data.event_date}\n*ВИД:* ${
      data.event_is_offline ? "Живая встреча" : "Онлайн"
    }\n\n${data.event_is_offline ? "*АДРЕС:* " : "*ССЫЛКА:* "}${
      data.event_is_offline ? location : linkToEvent
    }\n\n${tags}`;

    return eventAgendaMessage;
  }

  prepareEventMessageToPublish(data) {
    if (!data) {
      return "";
    }

    const tags = this.prepareTagsMarkdown(data?.event_tags);
    const location = this.prepareAddressMarkdown(data.event_location);
    const linkToEvent = this.prepareEventLinkMarkdown(data.event_link);
    const organizer = this.prepareOrganizerMarkdown(data);
    const description = this.prepareDescription(data.event_description);

    const eventMessage = `*${
      data.event_name
    }*\n--------------------------\n${description}\n\n*ДАТА и ВРЕМЯ:* ${
      data.event_date
    }\n*ВИД:* ${
      data.event_is_offline ? "Живая встреча" : "Онлайн"
    }\n*ОРГАНИЗАТОР:* ${organizer}\n\n${
      data.event_is_offline ? "*АДРЕС: *" : "*ССЫЛКА:* "
    }${data.event_is_offline ? location : linkToEvent}\n\n${tags}`;

    return eventMessage;
  }
}

export default new EventService();
