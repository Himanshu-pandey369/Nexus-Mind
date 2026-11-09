import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  loading: false,
  isLoading: false,
  status: "Thinking...",
  error: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setLoading: (state, action) => {
      const val = Boolean(action.payload);
      state.loading = val;
      state.isLoading = val;
      if (!val) {
        state.status = "Thinking...";
      }
    },
    setStatus: (state, action) => {
      state.status = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const { setLoading, setStatus, setError, clearError } = chatSlice.actions;
export default chatSlice.reducer;
