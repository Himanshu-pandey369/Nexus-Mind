import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import { fetchCurrentUser, setUser } from "./redux/userSlice";

export default function App() {
  const dispatch = useDispatch();
  const { userData, loading } = useSelector((state) => state.user);

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  const handleLogin = (user) => {
    dispatch(setUser(user));
  };

  // Show a loading spinner while checking auth status
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-white dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  // Not logged in → Login page | Logged in → Home page
  return userData ? <Home /> : <Login onLogin={handleLogin} />;
}
