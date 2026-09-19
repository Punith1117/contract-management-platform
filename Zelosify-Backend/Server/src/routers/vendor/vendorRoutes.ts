import express from "express";
import vendorRequestRoutes from "./vendorRequestRoutes.js";
import vendorOpeningRoutes from "./vendorOpeningRoutes.js";

const router = express.Router();

/**
 * @route /vendor/requests
 */
router.use("/requests", vendorRequestRoutes);

/**
 * @route /vendor/openings and /vendor/profiles
 */
router.use("/", vendorOpeningRoutes);

export default router;
