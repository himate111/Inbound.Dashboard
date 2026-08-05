import { getDashboard, getFilterValues } from "../services/dashboardService.js";

export async function dashboard(req, res, next) {
  try {
    const data = await getDashboard(req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function filters(req, res, next) {
  try {
    const data = await getFilterValues();
    res.json(data);
  } catch (error) {
    next(error);
  }
}
