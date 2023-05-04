export const DELAY_DELETE = {
  IMMEDIATELY: 100,
  AFTER_2_SEC: 2000,
  AFTER_5_SEC: 5000,
};

export const BOT_COMMANDS = {
  ADD_USER: "/add",
  DELETE_COMMAND: "/delete",
  SPACE_CREATE: "/space_create",
  SPACE_LOGIN: "/space_login",
  OPEN_APP: "/open_app",
  NO_COMMAND: "",
};

export const BOT_STATE_MANAGER_MAPPING = {
  CREATE_SPACE_INIT: "create_space_init",
  SPACE_EDIT_NAME: "create_space_name",
  SPACE_EDIT_DESCRIPTION: "create_space_description",
  SPACE_FILE_UPLOAD: "upload_file",
  DEFAULT: null,
};

export const BOT_NAME = "cliquetestingbot";
