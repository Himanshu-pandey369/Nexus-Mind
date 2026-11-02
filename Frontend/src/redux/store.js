import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./userSlice";
import creditsReducer from "./creditsSlice";

const store = configureStore({
  reducer: {
    user: userReducer,
    credits: creditsReducer,
  },
});

export default store;
