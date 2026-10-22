import { useDispatch, useSelector } from "react-redux";
import { clearUser } from "../redux/userSlice";
import api from "../../utils/axios";

export default function Home() {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed:", err.message);
    } finally {
      dispatch(clearUser());
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-lg px-4 text-center">
        {/* Logo */}
        <div className="mb-8 inline-flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-fuchsia-600 text-lg font-bold text-white">
            N
          </div>
          <span className="text-xl font-semibold tracking-tight">
            NexusMind
          </span>
        </div>

        {/* Welcome */}
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome{userData?.name ? `, ${userData.name}` : ""}! 👋
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          You're signed in and ready to go. Start capturing your thoughts and
          building your second brain.
        </p>

        {/* User info card */}
        {userData && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-center gap-4">
              {userData.photoURL && (
                <img
                  src={userData.photoURL}
                  alt="avatar"
                  className="h-12 w-12 rounded-full"
                />
              )}
              <div className="text-left">
                {userData.name && (
                  <p className="font-medium">{userData.name}</p>
                )}
                {userData.email && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {userData.email}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-8 rounded-lg bg-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-950"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
