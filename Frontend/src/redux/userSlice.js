import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import getCurrentUser from "../features/getCurrentUser";

// Async thunk to fetch the current user
export const fetchCurrentUser = createAsyncThunk(
  "user/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const user = await getCurrentUser();
      return user;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState: {
    userData: null,
    loading: false,
    error: null,
  },
  reducers: {
    setUser: (state, action) => {
      state.userData = action.payload;
      state.error = null;
    },
    clearUser: (state) => {
      state.userData = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        // Only show loading spinner on initial load (no user yet).
        // Subsequent refreshes (e.g. from CreditModal) should not
        // flash the spinner or risk wiping the session.
        if (!state.userData) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        // Only update userData if we got a valid response.
        // If the server returned null/undefined, keep the existing session
        // so the user doesn't get logged out unexpectedly.
        if (action.payload) {
          state.userData = action.payload;
        }
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        // Do NOT clear userData here — a transient network error
        // should not log the user out.
      });
  },
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
