import { createStore, createEvent, createEffect } from "effector";

class StoreService {
  constructor() {
    this.stores = {};
  }

  async createBotStore(chatId) {
    const botStore = createStore({
      current_state: null,
      last_command: null,
      community_data: {
        name: null,
        description: null,
        id: null,
      },
      file_data: {
        file_name: null,
        file_id: null,
        file_size: null,
        mime_type: null,
        file_unique_id: null,
        to_space: null,
      },
    });

    this.stores[chatId] = botStore;

    return botStore;
  }

  async getBotStore(chatId) {
    if (this.stores[chatId]) {
      return this.stores[chatId];
    }

    const botStore = await this.createBotStore(chatId);
    return botStore;
  }

  async getStoreState(chatId) {
    const store = await this.getBotStore(chatId);
    return store.getState();
  }

  async updateCurrentState(chatId, currentState) {
    const botStore = await this.getBotStore(chatId);
    const updateCurrentBotState = createEvent();
    const updateStoreEffect = createEffect((params) => {
      botStore.setState(params);
    });

    updateCurrentBotState.watch((current_state) => {
      updateStoreEffect({ ...botStore.getState(), current_state });
    });
    updateCurrentBotState(currentState);
  }

  async updateLastCommand(chatId, lastCommand) {
    const botStore = await this.getBotStore(chatId);
    const updateLastCommandState = createEvent();
    const updateStoreEffect = createEffect((params) => {
      botStore.setState(params);
    });
    updateLastCommandState.watch((last_command) => {
      updateStoreEffect({ ...botStore.getState(), last_command });
    });
    updateLastCommandState(lastCommand);
  }

  async updateCommunityName(chatId, communityName) {
    const botStore = await this.getBotStore(chatId);
    const updateCommunityName = createEvent();
    const updateStoreEffect = createEffect((params) => {
      botStore.setState(params);
    });
    updateCommunityName.watch((name) => {
      updateStoreEffect({
        ...botStore.getState(),
        community_data: {
          ...botStore.getState().community_data,
          name,
        },
      });
    });
    updateCommunityName(communityName);
  }

  async updateCommunityDescription(chatId, communityInfo) {
    const botStore = await this.getBotStore(chatId);
    const updateCommunityDescription = createEvent();
    const updateStoreEffect = createEffect((params) => {
      botStore.setState(params);
    });
    updateCommunityDescription.watch((description) => {
      updateStoreEffect({
        ...botStore.getState(),
        community_data: {
          ...botStore.getState().community_data,
          description,
        },
      });
    });
    updateCommunityDescription(communityInfo);
  }

  async updateCommunityId(chatId, idData) {
    const botStore = await this.getBotStore(chatId);
    const updateCommunityIdDispatch = createEvent();
    const updateStoreEffect = createEffect((params) => {
      botStore.setState(params);
    });
    updateCommunityIdDispatch.watch((id) => {
      updateStoreEffect({
        ...botStore.getState(),
        community_data: {
          ...botStore.getState().community_data,
          id: id,
        },
      });
    });
    updateCommunityIdDispatch(idData);
  }

  async resetCurrentFile(chatId) {
    const botStore = await this.getBotStore(chatId);
    const resetCurrentFileDispatch = createEvent();

    const updateStoreEffect = createEffect((params) => {
      botStore.setState(params);
    });

    resetCurrentFileDispatch.watch(() => {
      updateStoreEffect({
        ...botStore.getState(),
        file_data: {
          file_name: null,
          file_id: null,
          file_size: null,
          mime_type: null,
          file_unique_id: null,
          to_space: null,
        },
      });
    });
    resetCurrentFileDispatch();
  }

  async prepareCurrentFileForUpload(chatId, fileData) {
    const botStore = await this.getBotStore(chatId);
    const prepareFileUploadDispatch = createEvent();

    const updateStoreEffect = createEffect((params) => {
      botStore.setState(params);
    });

    prepareFileUploadDispatch.watch(
      ({
        file_name,
        file_id,
        file_size,
        mime_type,
        file_unique_id,
        to_space,
      }) => {
        updateStoreEffect({
          ...botStore.getState(),
          file_data: {
            file_name: file_name,
            file_id: file_id,
            file_size: file_size,
            mime_type: mime_type,
            file_unique_id: file_unique_id,
            to_space: to_space,
          },
        });
      }
    );
    prepareFileUploadDispatch(fileData);
  }
}

export default new StoreService();
