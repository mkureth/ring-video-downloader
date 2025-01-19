require("dotenv/config");
const { RingApi } = require("ring-client-api");

async function loadPages() {
  const { env } = process;

  // Initialize Ring API
  const ringApi = new RingApi({
    refreshToken: env.RING_REFRESH_TOKEN,
    debug: true,
  });

  // Fetch locations and cameras
  const locations = await ringApi.getLocations();
  const allCameras = await ringApi.getCameras();

  console.log(
    `Found ${locations.length} location(s) with ${allCameras.length} camera(s).`
  );

  if (locations.length > 0 && locations[0].cameras.length > 0) {
    const loc = locations[0];
    let paginationToken = null;
    const allEvents = [];

    try {
      // Fetch all events with pagination
      do {
        const eventsResponse = await loc.getCameraEvents({
          paginationToken, // Pass the pagination token
        });

        console.log(eventsResponse);

        if (eventsResponse && eventsResponse.events.length > 0) {
          console.log(`Fetched ${eventsResponse.events.length} events.`);
          allEvents.push(...eventsResponse.events); // Accumulate events
        } else {
          console.log("No events on this page.");
        }

        // Update the pagination token for the next page
        paginationToken = eventsResponse.meta.pagination_key || null; // Use the correct property

        console.log(`Next pagination token: ${paginationToken}`);
      } while (paginationToken); // Continue fetching until no more pages are available

      console.log(`Total events fetched: ${allEvents.length}`);

      // Process all events
      for (const event of allEvents) {
        if (event?.ding_id_str) {
          console.log("Event Details:");
          console.log(`Created At: ${event?.created_at}`);
          console.log(`Ding ID: ${event?.ding_id_str}`);
          console.log(`Camera ID: ${event?.doorbot?.id}`);
          console.log(`Description: ${event?.doorbot?.description}`);
          console.log(
            `Person Detected: ${event?.cv_properties?.person_detected}`
          );
          console.log("---");
        }
      }
    } catch (error) {
      console.error("Error fetching camera events or processing data:", error);
    }
  } else {
    console.log("No locations or cameras available.");
  }

  // Listen for refresh token updates
  ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
      console.log("Refresh Token Updated: ", newRefreshToken);

      if (!oldRefreshToken) {
        return;
      }

      const fs = require("fs").promises;
      const currentConfig = await fs.readFile(".env", "utf8");
      const updatedConfig = currentConfig.replace(oldRefreshToken, newRefreshToken);

      await fs.writeFile(".env", updatedConfig, "utf8");
    }
  );
}

loadPages();
