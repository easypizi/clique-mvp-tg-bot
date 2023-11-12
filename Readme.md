# Maverick TG BOT - MVP

Bot services which used to provide services for tg bot.
Includes main commands and action for the bot.

---

### Requirements:

- Node.js ^18+
- Install npm dependencies (run `npm i` before running an app).

---

### .ENV

ENV File (should be created and filled with data).

Just copy `.env.example` and fill with real data.

---

Commands:

| Command       | Description                   |
| ------------- | ----------------------------- |
| npm run start | Start production app          |
| npm run dev   | Start app in development mode |

---

---

## Bot functionality:

## User Commands

The bot handles various user commands for different functionalities:

### /space_create

- **Description**: Allows users to create new spaces.
- **Functionality**: Guides the user through the process of creating a new space.

### /space_login

- **Description**: Command for users to log into a specific space.
- **Functionality**: Facilitates user login to a designated space, providing access and interaction capabilities within that space.

### /open_app

- **Description**: Opens the main application interface.
- **Functionality**: Provides a quick access link or method to open the application.

### /add

- **Description**: Adds new elements or entries to the system.
- **Functionality**: Handles addition of new data based on user input.

### /delete

- **Description**: Command to delete specific entities or data.
- **Functionality**: Invokes deletion logic based on the user's input and context.

### /help

- **Description**: Provides help or instructions to the user.
- **Functionality**: Supplies user with guidelines or assistance for using the bot.

---

## Bot Event Handling

The bot is designed to respond to various events and actions:

### Chat Interaction

- **my_chat_member**: Handles changes in bot's chat membership status.
- **new_chat_members**: Responds to the addition of new members in a chat.
- **chat_member**: Manages changes in chat members' status.
- **left_chat_member**: Deals with members leaving the chat.

### Message Processing

- **channel_post**: Processes messages posted in channels.
- **edited_channel_post**: Handles edits made to channel posts.
- **message**: Deals with incoming regular messages.
- **edited_message**: Responds to edits made to messages.

### Specific Content Handling

- **callback_query**: Manages callback queries from inline buttons.
- **audio**: Processes audio messages.
- **document**: Handles document files sent in the chat.
- **video**: Responds to video messages.

(Note: Each command and event is associated with specific functionalities and logic defined in the bot's code. Detailed behavior for each event and command can be extracted by analyzing corresponding handlers and services in the code.)

---

Made by gracegul hands of Frontend engineer by 💩&🩼 and ❤️.
