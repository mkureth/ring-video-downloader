require("dotenv/config");
const { RingApi } = require("ring-client-api");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2); // Get command-line arguments
const locationIndex = parseInt(args[0]) || 0; // Default to 0 if not provided
const filterDate = args[1] ? new Date(args[1]) : null; // Parse date if provided

async function getEvents() {
  const { env } = process;

  // Initialize Ring API
  const ringApi = new RingApi({
    refreshToken: env.RING_REFRESH_TOKEN,
    debug: true,
  });

  try {
    // Fetch locations and cameras
    const locations = await ringApi.getLocations();

    if (locations.length === 0) {
      console.error("No locations found. Ensure your Ring account is configured correctly.");
      return;
    }

    if (locationIndex < 0 || locationIndex >= locations.length) {
      console.error(`Invalid location index: ${locationIndex}. Available locations: 0 to ${locations.length - 1}`);
      return;
    }

    const loc = locations[locationIndex];
    const cameras = loc.cameras;

    if (cameras.length === 0) {
      console.error(`No cameras found for location: ${loc.name}.`);
      return;
    }

    console.log(`Using location: ${loc.name} with ${cameras.length} camera(s).`);

    let paginationToken = null;
    const allEvents = [];

    // Fetch all events using pagination
    do {
      const eventsResponse = await loc.getCameraEvents({
        pagination_key: paginationToken || undefined,
      });

      if (eventsResponse && eventsResponse.events.length > 0) {
        console.log(`Fetched ${eventsResponse.events.length} events.`);
        allEvents.push(...eventsResponse.events);
      } else {
        console.log("No events on this page.");
      }

      paginationToken = eventsResponse.meta.pagination_key || null;
      console.log(`Next pagination token: ${paginationToken}`);
    } while (paginationToken);

    console.log(`Total events fetched: ${allEvents.length}`);

    // Filter events based on the specified date (if provided)
    const filteredEvents = filterDate
      ? allEvents.filter((event) => {
          const eventDate = new Date(event.created_at);
          const eventDateString = eventDate.toISOString().split("T")[0];
          const filterDateString = filterDate.toISOString().split("T")[0];

          return eventDateString === filterDateString;
        })
      : allEvents;

    console.log(`${filteredEvents.length} event(s) match the filter criteria.`);

    // Save filtered events to a JSON file
    if (filteredEvents.length > 0) {
      const outputFolder = path.resolve("assets/data");
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }

      const jsonFilePath = path.join(outputFolder, `events.json`);

      try {
        fs.writeFileSync(jsonFilePath, JSON.stringify(filteredEvents, null, 2), "utf-8");
        console.log(`Events saved to ${jsonFilePath}`);
      } catch (error) {
        console.error(`Error saving events to JSON file:`, error);
      }
    } else {
      console.log("No valid events found.");
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

getEvents();
