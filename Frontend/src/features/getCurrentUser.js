import api from "../../utils/axios";

const getCurrentUser = async () => {
  try {
    const { data } = await api.get("/me");
    return data.user;
  } catch (error) {
    return null;
  }
};
export default getCurrentUser;
