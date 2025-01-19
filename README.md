# ring-video-downloader
Ring API to Download Videos

## Setup

- Clone the repository to your local environment
- Run `npm i` (assuming you already have [Node.js](https://nodejs.org/) installed)

## Authentication

- Run `npm run auth` to start the process. It should prompt you for email/password/token
- You will see a refresh token output like `"refreshToken": "eyJhbGciOi...afa1"`. You need to extract the value from the second part of this output, between the double quotes.
- Create a `.env` file in the root directory of this project and insert the following contents, replacing value with the one you got from the auth command above. _Make sure you don't include the quotes_:

```text
RING_REFRESH_TOKEN=eyJhbGciOi...afa1
```

## Run the Code

- `node index.js [location] [date]`
- Run `node index.js 0 2025-01-07` to download all videos for location 0 from 2025-01-07.
- Run `node index.js 0` to download all videos for location 0.
- Run `node index.js` default.


## Fixes needed

- `node pages.js` paginationToken is not loading the next page


## Next

- Fix paginationToken in pages.js example code
- Combine pages.js pagination into index.js to load all events from all pages
- Filter by date param.

