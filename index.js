require("dotenv/config");
const { RingApi } = require("ring-client-api");
const { readFile, writeFile } = require("fs");
const { promisify } = require("util");
const fs = require('fs');
const axios = require('axios');
const path = require('path');

async function example() {
  const { env } = process;

  // Initialize Ring API
  const ringApi = new RingApi({
    // This value comes from the .env file
    refreshToken: env.RING_REFRESH_TOKEN,
    debug: true,
  });

  // Fetch locations and cameras
  const locations = await ringApi.getLocations();
  const allCameras = await ringApi.getCameras();

  console.log(
    `Found ${locations.length} location(s) with ${allCameras.length} camera(s).`
  );

  // Fetch camera events and recording URL for the first location and camera
  if (locations.length > 0 && locations[0].cameras.length > 0) {
    const loc = locations[0];
    try {
      const events = await loc.getCameraEvents();

      // Get cameras
      console.log(loc.cameras);

      // Get events
      console.log(events.events[0]);

      for (const event of events.events) {
        if (event?.ding_id_str) {
          console.log(event?.ding_id_str);

          console.log(event?.doorbot.id);
          console.log(event?.doorbot.description);
          console.log(event?.cv_properties.person_detected);
        }
        if (event?.source_id) {
          console.log(event?.source_id);
        }
      }

      // Download videos
      if (events?.events?.length > 0) {
        // Ensure the "video" folder exists
        const videoFolder = path.resolve('video');
        if (!fs.existsSync(videoFolder)) {
          fs.mkdirSync(videoFolder);
        }

        for (const event of events.events) {
          if (event?.ding_id_str) {
            try {
              const recording = await loc.cameras[0].getRecordingUrl(
                event.ding_id_str,
                { transcoded: true } // Try transcoded recordings
              );

              console.log('Video URL:', recording);
              console.log('Video created_at:', event.created_at);

              // Format the created_at timestamp to be file name compatible
              const originalDate = new Date(event.created_at);
              originalDate.setHours(originalDate.getHours() - 8);
              const formattedDate = originalDate.toISOString().replace(/[:]/g, '-').replace('T', '_').replace('Z', '');

              const fileName = path.join(videoFolder, `video_${formattedDate}.mp4`);

              // Download and save the video
              const response = await axios({
                url: recording,
                method: 'GET',
                responseType: 'stream',
              });

              const writer = fs.createWriteStream(fileName);

              // Wait for the file to finish downloading before continuing
              await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.pipe(writer);
              });

              console.log(`Video saved as ${fileName}`);
            } catch (error) {
              console.error(`Error fetching video for ding_id_str ${event.ding_id_str}:`, error);
            }
          } else {
            console.log("Event does not have a valid ding_id_str:", event);
          }
        }
      } else {
        console.log("No valid events found.");
      }

    } catch (error) {
      console.error("Error fetching camera events or recording URL:", error);
    }
  } else {
    console.log("No locations or cameras available.");
  }

  // Subscribe to refresh token updates
  ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
      console.log("Refresh Token Updated: ", newRefreshToken);

      if (!oldRefreshToken) {
        return;
      }

      const currentConfig = await promisify(readFile)(".env");
      const updatedConfig = currentConfig
        .toString()
        .replace(oldRefreshToken, newRefreshToken);

      await promisify(writeFile)(".env", updatedConfig);
    }
  );

  // Monitor connection status
  for (const location of locations) {
    let haveConnected = false;
    location.onConnected.subscribe((connected) => {
      if (!haveConnected && !connected) {
        return;
      } else if (connected) {
        haveConnected = true;
      }

      const status = connected ? "Connected to" : "Disconnected from";
      console.log(`**** ${status} location ${location.name} - ${location.id}`);
    });
  }

  // List cameras and devices for all locations
  for (const location of locations) {
    const cameras = location.cameras;
    const devices = await location.getDevices();

    console.log(
      `\nLocation ${location.name} (${location.id}) has the following ${cameras.length} camera(s):`
    );

    for (const camera of cameras) {
      console.log(`- ${camera.id}: ${camera.name} (${camera.deviceType})`);
    }

    console.log(
      `\nLocation ${location.name} (${location.id}) has the following ${devices.length} device(s):`
    );

    for (const device of devices) {
      console.log(`- ${device.zid}: ${device.name} (${device.deviceType})`);
    }
  }

  // Monitor notifications for all cameras
  if (allCameras.length) {
    allCameras.forEach((camera) => {
      camera.onNewNotification.subscribe(({ ding, subtype }) => {
        const event =
          ding.detection_type === "motion"
            ? "Motion detected"
            : subtype === "ding"
            ? "Doorbell pressed"
            : `Video started (${subtype})`;

        console.log(
          `${event} on ${camera.name} camera. Ding id ${
            ding.id
          }.  Received at ${new Date()}`
        );
      });
    });

    console.log("Listening for motion and doorbell presses on your cameras.");
  }
}

example();
