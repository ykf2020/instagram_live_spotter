const puppeteer = require("puppeteer");
const { OBSWebSocket } = require("obs-websocket-js");
const cron = require('node-cron');

// Configuration
const config = {
  instagram: {
    username: "instagram_account",
    password: "instagram_password",
    targetUsername: "target_instagram_account",
  },
  obs: {
    url: "ws://127.0.0.1:4455",
    password: "password"
  },
  checkInterval: "*/10 * * * *", // Cron expression for every 10 minutes
  liveCheckKeyword: "直播", // Live keyword to check
  liveEndKeyword: "直播視訊已結束", // Live ended keyword
  browser: {
    headless: false,
    width: 1400,
    height: 812
  }
};

// Global variables
let browser = null;
let page = null;
let obs = null;
let isCheckingLive = false;
let isRecording = false;
let checkLiveTask = null;
let checkLiveEndTask = null;

/**
 * Initialize the browser and OBS connection
 */
async function initialize() {
  try {
    // Connect to OBS WebSocket
    obs = new OBSWebSocket();
    await obs.connect(config.obs.url, config.obs.password);
    console.log("Connected to OBS WebSocket");

    // Launch browser
    browser = await puppeteer.launch({
      headless: config.browser.headless,
      defaultViewport: { 
        width: config.browser.width, 
        height: config.browser.height 
      }
    });
    page = await browser.newPage();
    
    // Login to Instagram
    await loginToInstagram();
    
    return true;
  } catch (error) {
    console.error("Initialization error:", error);
    await cleanup();
    return false;
  }
}

/**
 * Login to Instagram
 */
async function loginToInstagram() {
  try {
    console.log("Logging in to Instagram...");
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
    });
    await page.type('input[name="username"]', config.instagram.username);
    await page.type('input[name="password"]', config.instagram.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    console.log("Successfully logged in to Instagram");
    
    // Navigate to target user's profile
    await goToTargetProfile();
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

/**
 * Navigate to target user's profile
 */
async function goToTargetProfile() {
  try {
    console.log(`Navigating to ${config.instagram.targetUsername}'s profile...`);
    await page.goto(`https://www.instagram.com/${config.instagram.targetUsername}/`, {
      waitUntil: "networkidle2",
    });
    console.log("Successfully navigated to target profile");
  } catch (error) {
    console.error("Navigation error:", error);
    throw error;
  }
}

/**
 * Check if the target user is live
 */
async function checkIsLive() {
  // Prevent concurrent checks
  if (isCheckingLive) {
    console.log("Already checking live status, skipping this check");
    return;
  }
  
  isCheckingLive = true;
  
  try {
    console.log("Checking if user is live...");
    
    // Refresh the page to get the latest status
    await page.reload({ waitUntil: "networkidle2" });
    
    const isLive = await page.evaluate((keyword) => {
      const avatarSection = document.querySelector("header section");
      if (!avatarSection) return false;
      return avatarSection.textContent.includes(keyword);
    }, config.liveCheckKeyword);
    
    if (isLive && !isRecording) {
      console.log("Live stream detected! Starting recording...");
      await watchLiveAndRecord();
    } else if (!isLive) {
      console.log("No live stream detected");
    }
  } catch (error) {
    console.error("Error checking live status:", error);
    // If there's an error, try to refresh the page or re-login
    try {
      await goToTargetProfile();
    } catch (refreshError) {
      console.error("Failed to refresh profile:", refreshError);
      // If refreshing fails, try to re-login
      try {
        await loginToInstagram();
      } catch (loginError) {
        console.error("Failed to re-login:", loginError);
      }
    }
  } finally {
    isCheckingLive = false;
  }
}

/**
 * Watch the live stream and start recording
 */
async function watchLiveAndRecord() {
  try {
    // Click on the live stream
    await page.click("header section");
    
    // Start recording with OBS
    await obs.call("StartRecord");
    isRecording = true;
    console.log("Recording started");
    
    // Stop the regular check while we're recording
    if (checkLiveTask) {
      checkLiveTask.stop();
      console.log("Paused regular live checks while recording");
    }
    
    // Set up a check for when the live stream ends
    checkLiveEndTask = cron.schedule('* * * * *', async () => { // Check every minute
      try {
        const isLiveEnded = await page.evaluate((keyword) => {
          const footer = document.querySelector("footer");
          if (!footer) return false;
          return footer.textContent.includes(keyword);
        }, config.liveEndKeyword);
        
        if (isLiveEnded) {
          console.log("Live stream ended");
          await stopRecording();
        } else {
          console.log("Live stream is still ongoing");
        }
      } catch (error) {
        console.error("Error checking if live ended:", error);
      }
    });
    
  } catch (error) {
    console.error("Error watching live and recording:", error);
    // Try to stop recording if there was an error
    await stopRecording();
  }
}

/**
 * Stop recording and resume regular checks
 */
async function stopRecording() {
  try {
    if (isRecording) {
      await obs.call("StopRecord");
      isRecording = false;
      console.log("Recording stopped");
    }
    
    // Stop the live end check
    if (checkLiveEndTask) {
      checkLiveEndTask.stop();
      checkLiveEndTask = null;
    }
    
    // Resume regular checks
    if (checkLiveTask) {
      checkLiveTask.start();
      console.log("Resumed regular live checks");
    }
    
    // Go back to the profile page
    await goToTargetProfile();
  } catch (error) {
    console.error("Error stopping recording:", error);
  }
}

/**
 * Clean up resources
 */
async function cleanup() {
  console.log("Cleaning up resources...");
  
  // Stop any scheduled tasks
  if (checkLiveTask) {
    checkLiveTask.stop();
    checkLiveTask = null;
  }
  
  if (checkLiveEndTask) {
    checkLiveEndTask.stop();
    checkLiveEndTask = null;
  }
  
  // Close browser
  if (browser) {
    try {
      await browser.close();
      console.log("Browser closed");
    } catch (error) {
      console.error("Error closing browser:", error);
    }
    browser = null;
    page = null;
  }
  
  // Disconnect from OBS
  if (obs) {
    try {
      if (isRecording) {
        await obs.call("StopRecord");
        isRecording = false;
        console.log("Recording stopped");
      }
      await obs.disconnect();
      console.log("Disconnected from OBS");
    } catch (error) {
      console.error("Error disconnecting from OBS:", error);
    }
    obs = null;
  }
}

/**
 * Handle process termination
 */
function setupProcessHandlers() {
  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('Received SIGINT. Cleaning up...');
    await cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Cleaning up...');
    await cleanup();
    process.exit(0);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await cleanup();
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled promise rejection:', reason);
    await cleanup();
    process.exit(1);
  });
}

/**
 * Main function
 */
async function main() {
  setupProcessHandlers();
  
  const initialized = await initialize();
  if (!initialized) {
    console.error("Failed to initialize. Exiting...");
    process.exit(1);
  }
  
  // Schedule the live check using node-cron
  checkLiveTask = cron.schedule(config.checkInterval, checkIsLive);
  
  // Run an initial check immediately
  await checkIsLive();
  
  console.log(`Instagram Live Spotter is running. Checking for ${config.instagram.targetUsername}'s live streams every 10 minutes.`);
}

// Start the application
main().catch(async (error) => {
  console.error("Main function error:", error);
  await cleanup();
  process.exit(1);
});
