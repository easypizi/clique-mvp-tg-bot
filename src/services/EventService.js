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

  prepareEventMessageToPublish(data) {
    if (!data) {
      return "";
    }

    const tags = data?.event_tags?.length
      ? data.event_tags
          .replaceAll(" ", "")
          .split(",")
          .map((tag) => `#${tag.replaceAll("-", "\\_")}`)
          .join(" ")
      : "";
    const address = `${data.event_location.country}, ${
      data.event_location.city
    }, ${data.event_location.address}\n\n${
      data.event_location.geo.length
        ? "*MAP LINK:* " + `[Click to open]( ${data.event_location.geo} )`
        : ""
    }`;
    const linkToEvent = `[Link to event]( ${data.event_link} )`;

    const organizer = `${
      data.event_organizer_credentials
    } ( ${data.event_organizer_telegram_link.replaceAll("_", "\\_")} )`;

    const eventMessage = `*${data.event_name}*\n--------------------------\n${
      data.event_description
    }\n\n*DATE and TIME:* ${data.event_date}\n*TYPE:* ${
      data.event_is_offline ? "Offline" : "Online"
    }\n*CONTACTS:* ${organizer}\n${
      data.event_is_offline ? "*ADDRESS: *" : "*LINK:* "
    }${data.event_is_offline ? address : linkToEvent}\n\n${tags}`;

    return eventMessage;
  }

  prepareEventMessageToAdminCheck(data) {
    const tags = data?.event_tags?.length
      ? data.event_tags
          .replaceAll(" ", "")
          .split(",")
          .map((tag) => `#${tag.replaceAll("-", "\\_")}`)
          .join(" ")
      : "";
    const address = `${data.event_location.country}, ${
      data.event_location.city
    }, ${data.event_location.address}\n\n${
      data.event_location.geo.length
        ? "*MAP LINK:* " + `[Click to open]( ${data.event_location.geo} )`
        : ""
    }`;

    const linkToEvent = `[Link to event]( ${data.event_link} )`;

    const organizer = `${
      data.event_organizer_credentials
    } ( ${data.event_organizer_telegram_link.replaceAll("_", "\\_")} )`;

    const eventAgendaMessage = `||${
      data.event_id
    }||\n\n${organizer} want to publish information about event:\n\n*${
      data.event_name
    }*\n\n${data.event_description}\n\n*DATE and TIME:* ${
      data.event_date
    }\n*TYPE:* ${data.event_is_offline ? "Offline" : "Online"}\n${
      data.event_is_offline ? "*ADDRESS: *" : "*LINK:* "
    }${data.event_is_offline ? address : linkToEvent}\n\n${tags}`;

    console.log(eventAgendaMessage);

    return encodeURIComponent(eventAgendaMessage);
  }
}

export default new EventService();
