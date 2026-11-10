import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../utils/axios";

// Async thunk to fetch authoritative credit balance
export const fetchCreditBalance = createAsyncThunk(
  "credits/fetchCreditBalance",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/credits/balance");
      return response.data.balance;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch credit balance"
      );
    }
  }
);

// Async thunk to fetch paginated credit transaction history (agent usage & allocations)
export const fetchCreditHistory = createAsyncThunk(
  "credits/fetchCreditHistory",
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/credits/history", {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch credit history"
      );
    }
  }
);

// Async thunk to fetch paginated payment purchase transactions from Payment service
export const fetchPaymentHistory = createAsyncThunk(
  "credits/fetchPaymentHistory",
  async ({ page = 1, limit = 10 } = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/payment/history", {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch payment history"
      );
    }
  }
);

const creditsSlice = createSlice({
  name: "credits",
  initialState: {
    balance: null,
    loading: false,
    history: [],
    historyTotal: 0,
    historyPage: 1,
    historyLoading: false,
    error: null,
    // Payment transaction history
    paymentHistory: [],
    paymentHistoryTotal: 0,
    paymentHistoryPage: 1,
    paymentHistoryTotalPages: 1,
    paymentHistoryLoading: false,
    paymentHistoryError: null,
  },
  reducers: {
    setCreditBalance: (state, action) => {
      state.balance = action.payload;
    },
    deductCreditBalance: (state, action) => {
      if (typeof state.balance === "number") {
        state.balance = Math.max(0, state.balance - action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Balance
      .addCase(fetchCreditBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCreditBalance.fulfilled, (state, action) => {
        state.loading = false;
        state.balance = action.payload;
      })
      .addCase(fetchCreditBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Credit Usage History
      .addCase(fetchCreditHistory.pending, (state) => {
        state.historyLoading = true;
      })
      .addCase(fetchCreditHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.history = action.payload.transactions || [];
        state.historyTotal = action.payload.total || 0;
        state.historyPage = action.payload.page || 1;
      })
      .addCase(fetchCreditHistory.rejected, (state, action) => {
        state.historyLoading = false;
        state.error = action.payload;
      })
      // Payment Purchase History
      .addCase(fetchPaymentHistory.pending, (state) => {
        state.paymentHistoryLoading = true;
        state.paymentHistoryError = null;
      })
      .addCase(fetchPaymentHistory.fulfilled, (state, action) => {
        state.paymentHistoryLoading = false;
        state.paymentHistory = action.payload.payments || [];
        state.paymentHistoryTotal = action.payload.total || 0;
        state.paymentHistoryPage = action.payload.page || 1;
        state.paymentHistoryTotalPages = action.payload.totalPages || 1;
      })
      .addCase(fetchPaymentHistory.rejected, (state, action) => {
        state.paymentHistoryLoading = false;
        state.paymentHistoryError = action.payload;
      });
  },
});

export const { setCreditBalance, deductCreditBalance } = creditsSlice.actions;
export default creditsSlice.reducer;
