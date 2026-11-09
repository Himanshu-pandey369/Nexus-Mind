import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./userSlice.js";
import creditsReducer from "./creditsSlice.js";
import chatReducer from "./chatSlice.js";

const store = configureStore({
  reducer: {
    user: userReducer,
    credits: creditsReducer,
    chat: chatReducer,
  },
});

export default store;
