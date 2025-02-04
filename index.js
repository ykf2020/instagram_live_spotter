const puppeteer = require("puppeteer");
const { OBSWebSocket } = require("obs-websocket-js");

(async () => {
  const username = "instagram_account";
  const password = "instagram_password";
  const targetUsername = "target_instagram_account";

  // 連接 obs websocket
  const obs = new OBSWebSocket();
  await obs.connect("ws://127.0.0.1:4455", "password");

  // 啟動瀏覽器
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 812 },
  }); // headless: false 可視化瀏覽器
  const page = await browser.newPage();

  try {
    // 登入 Instagram
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
    });
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    await page.goto(`https://www.instagram.com/${targetUsername}/`, {
      waitUntil: "networkidle2",
    });

    const checkIsLiveInterval = setInterval(async () => {
      const isLive = await page.evaluate(() => {
        const liveKeyWord = "直播";
        const avatarSection = document.querySelector("header section");
        if (!avatarSection) return false;

        return avatarSection.textContent.includes(liveKeyWord);
      });
      if (isLive) {
        console.log("直播中");
        clearInterval(checkIsLiveInterval);
        await watchLiveAndRecord();
      } else {
        console.log("沒有直播");
        await page.reload({ waitUntil: "networkidle2" });
      }
    }, 10 * 60 * 1000);

    const watchLiveAndRecord = async () => {
      await page.click("header section");
      await obs.call("StartRecord");
      const checkIsLiveEnded = setInterval(async () => {
        const isLiveEnded = await page.evaluate(() => {
          const liveEndKeyWord = "直播視訊已結束";
          const footer = document.querySelector("footer");
          if (!footer) return false;

          return footer.textContent.includes(liveEndKeyWord);
        });
        if (isLiveEnded) {
          console.log("直播結束");
          clearInterval(checkIsLiveEnded);
          await obs.call("StopRecord");
          await browser.close();
          await obs.disconnect();
          return;
        } else {
          console.log("直播尚未結束");
        }
      }, 60 * 1000);
    };
  } catch (error) {
    console.error("error:", error);
    await browser.close();
    await obs.disconnect();
    return;
  }
})();
