import { pino } from "pino";

const logger = pino({
  transport: {
    targets: [
      {
        target: "pino/file",
        level: "debug",
        options: {
          destination: "./app.log",
          append: false,
        },
      },
      {
        target: "pino-pretty",
        level: "debug",
        options: {},
      },
    ],
  },
});
