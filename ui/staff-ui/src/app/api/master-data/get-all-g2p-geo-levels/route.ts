/**
 * Kept for metadata and pickers that name this endpoint (e.g. a `geo-hierarchy`
 * widget's `levelsEndpoint: "get-all-g2p-geo-levels"`). It now reads the same
 * catalogue levels as `geo-levels` (MDS /catalogue/get_geo_levels), so every
 * location widget gets its levels from one place.
 */
export { POST } from "../geo-levels/route";
