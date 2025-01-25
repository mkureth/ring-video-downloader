
# Ring Video Downloader

A utility to interact with the Ring API for downloading videos or creating event logs.

## Setup

1. **Clone the Repository**:  
   Clone the repository to your local environment:
   ```bash
   git clone <repository-url>
   ```

2. **Install Dependencies**:  
   Run `npm i` to install the required packages. Ensure you have [Node.js](https://nodejs.org/) installed.

## Authentication

1. **Run Auth Command**:  
   Execute the following command to authenticate:
   ```bash
   npm run auth
   ```
   You will be prompted for your email/password/token.

2. **Retrieve Refresh Token**:  
   After authentication, you will receive a refresh token in the output. It will look something like this:
   ```json
   "refreshToken": "eyJhbGciOi...afa1"
   ```
   Extract the value of the `refreshToken` (without quotes).

3. **Create `.env` File**:  
   In the root directory, create a file named `.env` and add the refresh token like so:
   ```env
   RING_REFRESH_TOKEN=eyJhbGciOi...afa1
   ```

## Run the Script

Use the following command structure to execute the script:

```bash
node index.js [action] [locationIndex] [filterDate]
```

### Parameters:
- **`action`**: Specify the action to perform. Options:
  - `events`: Fetch and save events to a JSON file.
  - `videos`: Download videos for the specified events.
- **`locationIndex`**: (Optional) The location index to use. Defaults to `0`.
- **`filterDate`**: (Optional) Filter events/videos by a specific date in `YYYY-MM-DD` format.

### Examples:
- To create a JSON file of events for location `0` on `2025-01-07`:
  ```bash
  node index.js events 0 2025-01-07
  ```
- To download all videos for location `0` on `2025-01-07`:
  ```bash
  node index.js videos 0 2025-01-07
  ```

## Directory Structure

- **`assets/data`**: Folder where the `events.json` file is saved after running the `events` action.
- **`assets/videos`**: Folder where the downloaded videos are stored after running the `videos` action.

## Notes

- Ensure the `assets/data` and `assets/videos` directories exist, or the script will create them automatically.
- If no `locationIndex` or `filterDate` is provided, the script defaults to `0` and fetches all events/videos, respectively.
