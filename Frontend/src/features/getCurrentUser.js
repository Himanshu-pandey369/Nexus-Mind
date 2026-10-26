import api from "../../utils/axios";

const getCurrentUser = async () => {
  try {
    const { data } = await api.get("/me");
    return data.user;
  } catch {
    return null;
  }
};
export default getCurrentUser;
