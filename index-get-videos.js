require("dotenv/config");
const { RingApi } = require("ring-client-api");
const { readFile, writeFile } = require("fs").promises;
const fs = require("fs");
const axios = require("axios");
const path = require("path");

const args = process.argv.slice(2); // Get command-line arguments
const locationIndex = parseInt(args[0]) || 0; // Default to 0 if not provided
const filterDate = args[1] ? new Date(args[1]) : null; // Parse date if provided

async function getVideos() {
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

    // Read events from the local JSON file
    const data = await readFile("assets/data/events.json", "utf-8");
    const events = JSON.parse(data);

    console.log(`Loaded ${events.length} events from assets/data/events.json.`);

    // Filter events based on the specified date (if provided)
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
        fs.mkdirSync(videoFolder, { recursive: true }); // Ensure nested folders are created
      }

      for (const event of filteredEvents) {
        if (event?.ding_id_str) {
          try {
            // Retrieve recording URL
            const recording = await cameras[0].getRecordingUrl(event.ding_id_str, {
              transcoded: true,
            });

            console.log("Video URL:", recording);
            console.log("Video created_at:", event.created_at);

            const originalDate = new Date(event.created_at);
            originalDate.setHours(originalDate.getHours() - 8);
            const formattedDate = originalDate
              .toISOString()
              .replace(/[:]/g, "-")
              .replace("T", "_")
              .replace("Z", "");

            const fileName = path.join(videoFolder, `video_${formattedDate}.mp4`);

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
    console.error("Error occurred:", error);
  }
}

getVideos();
