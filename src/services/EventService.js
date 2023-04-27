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
}

export default new EventService();
