import axios from "axios";
import FormData from "form-data";
import * as dotenv from "dotenv";
dotenv.config();
import { readFile, writeFile } from "fs/promises";
import { pino } from "pino";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { CreateCertificateResponse } from "./types";

const API_KEY = process.env.API_KEY;
const ROOT_URL = "https://api.zerossl.com";
const ROOT_URL_QUERY = `?access_key=${API_KEY}`;

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

const validateCSR = async ({ csr }: { csr: string }) => {
  try {
    const ACTION_URL = `${ROOT_URL}/validation/csr${ROOT_URL_QUERY}`;

    const formData = new FormData();
    formData.append("csr", csr);

    const validateStatus = await axios.post<{
      valid: boolean;
      error: any;
    }>(ACTION_URL, formData);

    return validateStatus.data.valid;
  } catch (error: any) {
    logger.error(error);
  }
};

const createCertificate = async ({
  csr,
  domain,
}: {
  csr: string;
  domain: string;
}): Promise<CreateCertificateResponse | undefined> => {
  try {
    const ACTION_URL = `${ROOT_URL}/certificates${ROOT_URL_QUERY}`;

    const isCSRValid = await validateCSR({ csr });

    if (!isCSRValid) {
      throw new Error("CSR is not valid");
    }

    const formData = new FormData();
    formData.append("certificate_domain", domain);
    formData.append("certificate_csr", csr);
    formData.append("certificates_validity_days", 90);

    const requestCertificate = await axios.post<CreateCertificateResponse>(
      ACTION_URL,
      formData
    );

    return requestCertificate.data;
  } catch (error) {
    logger.error(error);
  }
};

const main = async () => {
  try {
    const { domain, csrPath, projectDir } = await yargs(hideBin(process.argv))
      .usage(
        "Usage: $0 --csr-path=[string] --domain=[string] --project-dir=[string]"
      )
      .string(["domain", "csr-path", "project-dir"])
      .demandOption(["domain", "csr-path", "project-dir"]).argv;

    const csrContent = await readFile(csrPath, { encoding: "utf-8" });

    const certificate = await createCertificate({ domain, csr: csrContent });

    if (!certificate)
      throw new Error("Something went wrong when creating certificate");

  } catch (error: any) {
    logger.error(error);
  }
};

main();
