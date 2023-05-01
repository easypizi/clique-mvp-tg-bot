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
      .replaceAll(" ", "")
      .replaceAll("_", "\\_")
      .replaceAll("-", "\\_")
      .split(",")
      .map((tag) => `#${tag}`)
      .join(" ");
  }

  prepareAddressMarkdown({ country, city, address, geo }) {
    if (!country || !city || !address) {
      return "WORLD (Location was not provided)";
    }

    const location = `${country}, ${city}, ${address}\n${
      geo.length
        ? "*MAP LINK:* " + `[Click to open](${data.event_location.geo})`
        : ""
    }`;

    return location.replaceAll("_", "\\_");
  }

  prepareEventLinkMarkdown(link) {
    if (!link) {
      return null;
    }

    return `[Link to event](${link})`;
  }

  prepareOrganizerMarkdown({
    event_organizer_credentials,
    event_organizer_telegram_link,
  }) {
    if (!event_organizer_credentials || !event_organizer_telegram_link) {
      return "Anonymous";
    }

    const result = `${event_organizer_credentials} ${event_organizer_telegram_link}`;

    return result.replaceAll("_", "\\_");
  }

  prepareDescription(description) {
    if (!description || !description.length) {
      return "";
    }

    return description.replaceAll("_", "\\_").replaceAll("@", "\\@");
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
    }||\n\n${organizer} want to publish information about event:\n\n*${
      data.event_name
    }*\n\n${description}\n\n*DATE and TIME:* ${data.event_date}\n*TYPE:* ${
      data.event_is_offline ? "Offline" : "Online"
    }\n\n${data.event_is_offline ? "*ADDRESS:* " : "*LINK:* "}${
      data.event_is_offline ? location : linkToEvent
    }\n\n${tags}`;

    return eventAgendaMessage;
  }

  prepareEventMessageToPublish(data) {
    if (!data) {
      return "";
    }

    const tags = data?.event_tags?.length
      ? data.event_tags
          .replaceAll(" ", "")
          .replaceAll("_", "\\_")
          .split(",")
          .map((tag) => `#${tag.replaceAll("-", "\\_")}`)
          .join(" ")
      : "";

    const address = `${data.event_location.country}, ${
      data.event_location.city
    }, ${data.event_location.address}\n${
      data.event_location.geo.length
        ? "*MAP LINK:* " + `[Click to open](${data.event_location.geo})`
        : ""
    }`;
    const linkToEvent = `[Link to event](${data.event_link})`;

    const organizer = `${
      data.event_organizer_credentials
    } ${data.event_organizer_telegram_link.replaceAll("_", "\\_")}`;

    const eventMessage = `*${data.event_name}*\n--------------------------\n${
      data.event_description
    }\n\n*DATE and TIME:* ${data.event_date}\n*TYPE:* ${
      data.event_is_offline ? "Offline" : "Online"
    }\n*CONTACTS:* ${organizer}\n\n${
      data.event_is_offline ? "*ADDRESS: *" : "*LINK:* "
    }${data.event_is_offline ? address : linkToEvent}\n\n${tags}`;

    return eventMessage;
  }
}

export default new EventService();
