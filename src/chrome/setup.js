const Chrome = require('chrome-remote-interface')
const chromium = require('chrome-aws-lambda')
const { spawn } = require('child_process')

const options = chromium.args.concat(['--remote-debugging-port=9222'])

let client;

export const getCDP = async () => {
  if (client) return client;

  const path = await chromium.executablePath;
  chrome = spawn(path, options)
  // chrome.stdout.on('data', data => console.log(data.toString()))
  // chrome.stderr.on('data', data => console.log(data.toString()))

  client = await Chrome();
  console.log('CRI client', client);
  return client;
}
