require('@babel/polyfill');
const { getCDP } = require('./setup');
const Cdp = getCDP();
const log = require("../utils/log");
const sleep = require("../utils/sleep");

let viewport = [
  Number(process.env.VIEWPORT_WIDTH) || 1280,
  Number(process.env.VIEWPORT_HEIGHT) || 800
];

let mobileViewport = [
  Number(process.env.MOBILE_VIEWPORT_WIDTH) || 375,
  Number(process.env.MOBILE_VIEWPORT_HEIGHT) || 667
];
async function captureScreenshotOfUrl(url, mobile = false) {
  const LOAD_TIMEOUT = Number(process.env.PAGE_LOAD_TIMEOUT) || 1000 * 10;
  var requestCounterMinWaitMs =
    Number(process.env.AFTER_PAGE_LOAD_MIN_TIMEOUT) || 3000; // Wait for at least a few seconds
  var requestCounterMaxWaitMs = LOAD_TIMEOUT;

  let result;
  let loaded = false;

  // Check if loading every 100 ms
  const loading = async (startTime = Date.now()) => {
    if (!loaded && Date.now() - startTime < LOAD_TIMEOUT) {
      await sleep(100);
      await loading(startTime);
    }
  };

  // const [tab] = await Cdp.List();
  // const client = await Cdp({ host: "127.0.0.1", target: tab });
  client = Cdp;
  const { Network, Page, Runtime, Emulation, DOM } = client;

  // Track the number of requests
  var numSent = 0;
  var numReceived = 0;

  Page.loadEventFired(() => {
    // Once the page has been loaded
    var startTime = new Date().getTime();
    function minWaitTimeExceeded() {
      return new Date().getTime() - startTime > requestCounterMinWaitMs;
    }

    function maxWaitTimeExceeded() {
      return new Date().getTime() - startTime > requestCounterMaxWaitMs;
    }

    // Check if all ajax requests are done
    var ajaxDoneInterval = setInterval(function () {
      log("Sent and recived requests", numSent, numReceived);
      if (numSent == numReceived && minWaitTimeExceeded()) {
        log("No pending requests and min wait time was exceeded");
        clearInterval(ajaxDoneInterval);
        loaded = true;
      } else if (maxWaitTimeExceeded()) {
        log(
          "Timed out. Waited " +
          (new Date().getTime() - startTime) +
          " ms. Had been still waiting for " +
          (numSent - numReceived) +
          " ajax requests"
        );
        clearInterval(ajaxDoneInterval);
        loaded = true;
      } else {
        if (numSent == numReceived) {
          log(
            "No pending ajax requests, but still waiting for minWaitTime of " +
            requestCounterMinWaitMs +
            ". Current wait: " +
            (new Date().getTime() - startTime)
          );
        } else {
          log(
            "Still waiting for " + (numSent - numReceived) + " ajax requests"
          );
        }
      }
    }, 500);
  });

  try {
    await Promise.all([Network.enable(), Page.enable(), DOM.enable()]);

    if (mobile) {
      await Network.setUserAgentOverride({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 10_0_1 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14A403 Safari/602.1"
      });
    }

    if (mobile) {
      viewport = mobileViewport;
    }

    const device = {
      width: viewport[0],
      height: viewport[1], // height: 0
      deviceScaleFactor: 0,
      mobile: !!mobile,
      fitWindow: false
    };
    await Emulation.setVisibleSize({ width: viewport[0], height: viewport[1] });

    await Page.navigate({ url });
    await Page.loadEventFired();
    await loading();

    // const {
    //   result: {
    //     value: { height }
    //   }
    // } = await Runtime.evaluate({
    //   expression: `(
    //     () => ({ height: document.body.scrollHeight })
    //   )();
    //   `,
    //   returnByValue: true
    // });

    const {
      root: { nodeId: documentNodeId }
    } = await DOM.getDocument();
    const { nodeId: bodyNodeId } = await DOM.querySelector({
      selector: "body",
      nodeId: documentNodeId
    });

    const {
      model: { height }
    } = await DOM.getBoxModel({ nodeId: bodyNodeId });
    await Emulation.setVisibleSize({ width: device.width, height: height });
    await Emulation.setDeviceMetricsOverride({
      width: device.width,
      height: height,
      screenWidth: device.width,
      screenHeight: height,
      deviceScaleFactor: 0,
      fitWindow: false,
      mobile: !!mobile
    });
    await Emulation.setPageScaleFactor({ pageScaleFactor: 0 });

    const screenshot = await Page.captureScreenshot({
      format: "png",
      fromSurface: true
    });

    result = screenshot.data;
  } catch (error) {
    console.error(error);
  }
  await client.close();

  return result;
}

module.exports = captureScreenshotOfUrl;

// For local debugging:
//
// Run in bash:
// alias google-chrome="/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"
// google-chrome --headless --hide-scrollbars --remote-debugging-port=9222 --disable-gpu & echo $!
//
// And uncomment:
// const fs = require("fs");
// captureScreenshotOfUrl("https://slavivanov1.typeform.com/to/hbkmKc").then(
//   data => {
//     const buffer = new Buffer(data, "base64");

//     fs.writeFile("desktop.png", buffer, "base64", function(err) {
//       if (err) {
//         console.error(err);
//       } else {
//         log("Screenshot saved");
//       }
//     });
//   }
// );

// And run:
// node src/chrome/screenshot.js && open desktop.png
