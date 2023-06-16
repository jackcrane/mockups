import fs from "fs";
import inquirer from "inquirer";
import ora from "ora";
import sharp from "sharp";
import { createCanvas, loadImage } from "canvas";
const devices = JSON.parse(fs.readFileSync("./devices.json", "utf-8")).devices;

async function main() {
  const { screenshotPath } = await inquirer.prompt([
    {
      name: "screenshotPath",
      message: "Enter the path to the screenshot:",
      type: "input",
    },
  ]);

  const screenshot = sharp(screenshotPath);
  const { width, height } = await screenshot.metadata();

  const matchingDevices = devices.filter(
    (device) => device.width === width && device.height === height
  );

  if (matchingDevices.length === 1) {
    const guessedDevice = matchingDevices[0];
    const { useGuessedDevice } = await inquirer.prompt([
      {
        name: "useGuessedDevice",
        message: `This screenshot looks like it is from a ${guessedDevice.manufacturer} ${guessedDevice.model}. Do you want to use this model?`,
        type: "confirm",
      },
    ]);

    if (useGuessedDevice) {
      await createMockup(screenshot, guessedDevice);
    } else {
      await selectDevice(screenshot);
    }
  } else if (matchingDevices.length > 1) {
    const { selectFromMatchingDevices } = await inquirer.prompt([
      {
        name: "selectFromMatchingDevices",
        message:
          "We found multiple devices with matching dimensions. Do you want to choose from these devices?",
        type: "confirm",
      },
    ]);

    if (selectFromMatchingDevices) {
      await selectMatchingDevice(screenshot, matchingDevices);
    } else {
      await selectDevice(screenshot);
    }
  } else {
    await selectDevice(screenshot);
  }
}

async function selectMatchingDevice(screenshot, matchingDevices) {
  const choices = matchingDevices.map((device) => ({
    name: `${device.manufacturer} ${device.model}`,
    value: device,
  }));

  choices.push({ name: "None of these", value: null });

  const { device } = await inquirer.prompt([
    {
      name: "device",
      message: "Select a device model:",
      type: "list",
      choices,
    },
  ]);

  if (device) {
    await createMockup(screenshot, device);
  } else {
    await selectDevice(screenshot);
  }
}

async function selectDevice(screenshot) {
  const { device } = await inquirer.prompt([
    {
      name: "device",
      message: "Select a device model:",
      type: "list",
      choices: devices.map((device) => ({
        name: `${device.manufacturer} ${device.model}`,
        value: device,
      })),
    },
  ]);

  await createMockup(screenshot, device);
}

async function createMockup(screenshotPath, device) {
  const spinner = ora("Creating mockup...").start();

  try {
    const screenshot = await loadImage(screenshotPath);
    const bezel = await loadImage(device.blank_path);

    const canvas = createCanvas(device.width, device.height);
    const ctx = canvas.getContext("2d");

    const leftOffset = (device.width - screenshot.width) / 2;
    const topOffset = (device.height - screenshot.height) / 2;

    ctx.drawImage(bezel, 0, 0, device.width, device.height);
    ctx.drawImage(
      screenshot,
      leftOffset,
      topOffset,
      screenshot.width,
      screenshot.height
    );

    const out = fs.createWriteStream("output.png");
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    out.on("finish", () => {
      spinner.succeed("Mockup created successfully!");
    });

    out.on("error", (err) => {
      spinner.fail("Failed to create mockup!");
      console.error(err);
    });
  } catch (err) {
    spinner.fail("Failed to create mockup!");
    console.error(err);
  }
}

main();
