require("dotenv/config");
const { RingApi } = require("ring-client-api");
const { readFile, writeFile } = require("fs").promises;
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const slugify = require("slugify");

const args = process.argv.slice(2); // Get command-line arguments
const action = args[0]; // Action to perform (getEvents or getVideos)
const locationIndex = parseInt(args[1]) || 0; // Location index (default to 0 if not provided)
const filterDate = args[2] ? new Date(args[2]) : null; // Parse date if provided

async function initializeRingApi() {
  return new RingApi({
    refreshToken: process.env.RING_REFRESH_TOKEN,
    debug: true,
  });
}

async function getLocationAndCameras(ringApi, locationIndex) {
  const locations = await ringApi.getLocations();

  if (locations.length === 0) {
    throw new Error("No locations found. Ensure your Ring account is configured correctly.");
  }

  if (locationIndex < 0 || locationIndex >= locations.length) {
    throw new Error(`Invalid location index: ${locationIndex}. Available locations: 0 to ${locations.length - 1}`);
  }

  const location = locations[locationIndex];
  if (location.cameras.length === 0) {
    throw new Error(`No cameras found for location: ${location.name}.`);
  }

  return { location, cameras: location.cameras };
}

function filterEvents(events, filterDate) {
  if (!filterDate) return events;

  return events.filter((event) => {
    const eventDate = new Date(event.created_at).toISOString().split("T")[0];
    const filterDateString = filterDate.toISOString().split("T")[0];
    return eventDate === filterDateString;
  });
}

async function saveEventsToFile(events, filePath) {
  await writeFile(filePath, JSON.stringify(events, null, 2), "utf-8");
  console.log(`Events saved to ${filePath}`);
}

async function getEvents() {
  try {
    const ringApi = await initializeRingApi();
    const { location } = await getLocationAndCameras(ringApi, locationIndex);

    let paginationToken = null;
    const allEvents = [];

    do {
      const eventsResponse = await location.getCameraEvents({
        pagination_key: paginationToken || undefined,
      });

      if (eventsResponse && eventsResponse.events.length > 0) {
        allEvents.push(...eventsResponse.events);
      }

      paginationToken = eventsResponse.meta.pagination_key || null;
    } while (paginationToken);

    const filteredEvents = filterEvents(allEvents, filterDate);
    console.log(`${filteredEvents.length} event(s) match the filter criteria.`);

    const outputFolder = path.resolve("assets/data");
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    await saveEventsToFile(filteredEvents, path.join(outputFolder, "events.json"));
  } catch (error) {
    console.error("Error occurred:", error.message);
  }
}

async function getVideos() {
  try {
    const ringApi = await initializeRingApi();
    const { cameras } = await getLocationAndCameras(ringApi, locationIndex);

    // Read events from the local JSON file
    const data = await readFile("assets/data/events.json", "utf-8");
    const events = JSON.parse(data);

    console.log(`Loaded ${events.length} events from assets/data/events.json.`);

    const filteredEvents = filterDate
      ? events.filter((event) => {
          const eventDate = new Date(event.created_at);
          const eventDateString = eventDate.toISOString().split("T")[0];
          const filterDateString = filterDate.toISOString().split("T")[0];

          console.log("Event Date String:", eventDateString);
          console.log("Filter Date String:", filterDateString);

          return eventDateString === filterDateString;
        })
      : events;

    console.log(`${filteredEvents.length} event(s) match the filter criteria.`);

    // Download videos
    if (filteredEvents.length > 0) {
      const videoFolder = path.resolve("assets/videos");
      if (!fs.existsSync(videoFolder)) {
        fs.mkdirSync(videoFolder, { recursive: true });
      }

      for (const event of filteredEvents) {
        if (event?.ding_id_str) {
          try {

            const recording = await cameras[0].getRecordingUrl(event.ding_id_str, {
              transcoded: true,
            });

            console.log("Video URL:", recording);
            console.log("Video created_at:", event.created_at);

            const originalDate = new Date(event.created_at);
            const date = new Date(originalDate);
            const userTimeZoneDate = new Date(date.toLocaleString());

            const formattedDate = userTimeZoneDate
              .toISOString()
              .replace(/[:]/g, "-")
              .replace("T", "_")
              .replace("Z", "");

            const cameraName = slugify(event.doorbot.description, {replacement: '-', remove: undefined, lower: true, strict: false, locale: 'en', trim: true});

            const personDetected = (event.cv_properties.person_detected) ? '-person' : '';

            const fileName = path.join(videoFolder, `${formattedDate}-${cameraName}${personDetected}.mp4`);

            const response = await axios({
              url: recording,
              method: "GET",
              responseType: "stream",
            });

            const writer = fs.createWriteStream(fileName);

            await new Promise((resolve, reject) => {
              writer.on("finish", resolve);
              writer.on("error", reject);
              response.data.pipe(writer);
            });

            console.log(`Video saved as ${fileName}`);
          } catch (error) {
            console.error(
              `Error fetching video for ding_id_str ${event.ding_id_str}:`,
              error
            );
          }
        } else {
          console.log("Event does not have a valid ding_id_str:", event);
        }
      }
    } else {
      console.log("No valid events found.");
    }

  } catch (error) {
    console.error("Error occurred:", error.message);
  }
}

if (action === "events") {
  getEvents();
} else if (action === "videos") {
  getVideos();
} else {
  console.error(
    "Invalid action. Please specify 'events' or 'videos' as the first argument."
  );
  process.exit(1);
}
