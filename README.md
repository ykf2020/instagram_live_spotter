# Instagram Live Spotter

Watch someone's Instagram live status and automatically record the streaming when it's detected using OBS Studio.

## Features

- Automatically monitors an Instagram user's profile for live streams
- Starts recording with OBS Studio when a live stream is detected
- Stops recording when the live stream ends
- Robust error handling and recovery mechanisms
- Resource-efficient with scheduled checks instead of continuous polling
- Proper cleanup of resources on exit

## Installation

1. Install Node.js (version 14 or higher recommended)
2. Install OBS Studio and enable the WebSocket server:
   - Go to Tools > WebSocket Server Settings
   - Enable the WebSocket server
   - Set a password (optional)
   - Note the server port (default is 4455)
3. Clone this repository:
   ```
   git clone https://github.com/ykf2020/instagram_live_spotter.git
   cd instagram_live_spotter
   ```
4. Install dependencies:
   ```
   npm install
   ```
5. Configure the application by editing the config object in either `index.js` (original version) or `improved_index.js` (recommended):
   - Set your Instagram username and password
   - Set the target Instagram username to monitor
   - Configure OBS WebSocket connection details (URL and password)
   - Adjust check interval if needed (default is every 10 minutes)

## Usage

### Original Version (may cause server crashes with long-running instances)

```
node index.js
```

### Improved Version (recommended)

```
node improved_index.js
```

Or use the npm script:

```
npm run start:improved
```

## How It Works

1. The application logs into Instagram using your credentials
2. It navigates to the target user's profile
3. It periodically checks if the user is currently live streaming
4. When a live stream is detected, it:
   - Clicks on the live stream
   - Starts recording with OBS Studio
   - Monitors for the end of the live stream
5. When the live stream ends, it:
   - Stops recording
   - Returns to monitoring mode

## Improvements in the Enhanced Version

The improved version addresses several issues with the original implementation:

1. **Resource Management**: Uses node-cron for scheduled checks instead of setInterval, preventing memory leaks and server crashes
2. **Error Handling**: Implements robust error recovery mechanisms
3. **Concurrency Control**: Prevents multiple simultaneous checks that could cause issues
4. **Graceful Shutdown**: Properly cleans up resources when the application exits
5. **Configuration**: Centralizes all configuration in one place for easy customization
6. **Logging**: Provides detailed logging for better monitoring and debugging

## Troubleshooting

- If you encounter login issues, make sure your Instagram credentials are correct
- If OBS doesn't start recording, verify that the WebSocket server is enabled and the connection details are correct
- If the application crashes, check the error logs for details

## License

ISC
