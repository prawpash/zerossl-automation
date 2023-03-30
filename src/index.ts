import { pino } from "pino";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

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
const main = async () => {
  try {
    const { domain, csrPath, projectDir } = await yargs(hideBin(process.argv))
      .usage(
        "Usage: $0 --csr-path=[string] --domain=[string] --project-dir=[string]"
      )
      .string(["domain", "csr-path", "project-dir"])
      .demandOption(["domain", "csr-path", "project-dir"]).argv;

  } catch (error: any) {
    logger.error(error);
  }
};

main();
