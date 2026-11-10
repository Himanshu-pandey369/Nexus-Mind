import api from "../../utils/axios";

const getCurrentUser = async () => {
  const { data } = await api.get("/me");
  return data.user || null;
};
export default getCurrentUser;
