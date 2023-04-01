import axios from "axios";
import FormData from "form-data";
import * as dotenv from "dotenv";
dotenv.config();
import { readFile, writeFile } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
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

const sleep = async (milisecond: number) => {
  return new Promise((resolve) => setTimeout(resolve, milisecond));
};

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
    formData.append("certificate_domains", domain);
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

const createFileValidation = async ({
  certificate,
  projectDir,
}: {
  certificate: CreateCertificateResponse;
  projectDir: string;
}) => {
  try {
    // Check if `/` character exist on end of data and remove it
    const formattedProjectDir = projectDir.replace(/\/$/, "");

    const wellFolderPath = `${formattedProjectDir}/.well-known`;

    // Check if folder .well-known exists in project directory
    const isWellFolderExists = existsSync(wellFolderPath);

    // Make .well-known directory
    if (!isWellFolderExists) mkdirSync(wellFolderPath);

    const pkiValFolderPath = `${wellFolderPath}/pki-validation`;

    // Check if folder pki-validation exists in project directory
    const isPkiValFolderExist = existsSync(pkiValFolderPath);

    // Make pki-validation directory
    if (!isPkiValFolderExist) mkdirSync(pkiValFolderPath);

    const firstKey = Object.keys(certificate.validation.other_methods)[0];

    const splitValidationPath =
      certificate.validation.other_methods[
        firstKey
      ].file_validation_url_http.split("/");

    const fileName = splitValidationPath[splitValidationPath.length - 1];

    const fileContent =
      certificate.validation.other_methods[
        firstKey
      ].file_validation_content.join("\n");

    await writeFile(`${pkiValFolderPath}/${fileName}`, fileContent, {
      encoding: "utf-8",
      flag: "w",
    });

    return `${pkiValFolderPath}/${fileName}`;
  } catch (error) {
    logger.error(error);
  }
};

const verifyDomain = async ({ domain_id }: { domain_id: string }) => {
  try {
    const ACTION_URL = `${ROOT_URL}/certificates/${domain_id}/challenges${ROOT_URL_QUERY}`;

    const formData = new FormData();
    formData.append("validation_method", "HTTP_CSR_HASH");

    const verify = await axios.post<
      CreateCertificateResponse | { success: boolean; error: any }
    >(ACTION_URL, formData);

    // check if data has id key
    if ("id" in verify.data) return verify.data.status;

    throw new Error(verify.data.error);
  } catch (error) {
    logger.error(error);
  }
};

const getValidationStatus = async ({ domain_id }: { domain_id: string }) => {
  try {
    const ACTION_URL = `${ROOT_URL}/certificates/${domain_id}/status${ROOT_URL_QUERY}`;

    const validation = await axios.get<{
      validation_complete: number;
      details?: { [key: string]: { method: string; status: string } };
    }>(ACTION_URL);

    return validation.data.validation_complete;
  } catch (error) {
    logger.error(error);
  }
};

const downloadCertificate = async ({ domain_id }: { domain_id: string }) => {
  try {
    const ACTION_URL = `${ROOT_URL}/certificates/${domain_id}/download/return${ROOT_URL_QUERY}`;

    const certificate = await axios.get<{
      "certificate.crt": string;
      "ca_bundle.crt": string;
    }>(ACTION_URL);

    return certificate.data;
  } catch (error) {
    logger.error(error);
  }
};

const main = async () => {
  try {
    if (!API_KEY) throw new Error("API_KEY Not Found");

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

    logger.info("Request certificate complete");

    const validationFile = await createFileValidation({
      certificate,
      projectDir,
    });

    logger.info("Validation file has been created");
    logger.info(validationFile);

    const verification = await verifyDomain({ domain_id: certificate.id });

    if (!verification)
      throw new Error("Something went wrong when verify the domain");

    logger.info(`Status : ${verification}`);

    let validationStatus = await getValidationStatus({
      domain_id: certificate.id,
    });

    if (!validationStatus)
      throw new Error(
        "Something went wrong when get validation status of domain"
      );

    logger.info(`Validation Status: ${validationStatus}`);

    // loop to get validation status until get value = 1
    let iteration = 0;

    while (validationStatus == 0) {
      // stop looping when iteration variable equal 3
      if (iteration == 3)
        throw new Error("Something went wrong when validating domain");

      await sleep(30000);

      validationStatus = await getValidationStatus({
        domain_id: certificate.id,
      });

      iteration++;

      logger.info(`Validation Status: ${validationStatus}`);
    }

    const downloadedCertificate = await downloadCertificate({
      domain_id: certificate.id,
    });

    if (!downloadedCertificate)
      throw new Error("Something went wrong when download the certificate");

    logger.info("Certificate has been downloaded");

    // Write certificate to file
    await writeFile(
      "./certificate.crt",
      downloadedCertificate["certificate.crt"],
      { encoding: "utf-8", flag: "w" }
    );

    logger.info("certificate.crt file has been created");

    // Write ca bundle to file
    await writeFile("./ca_bundle.crt", downloadedCertificate["ca_bundle.crt"], {
      encoding: "utf-8",
      flag: "w",
    });

    logger.info("ca_bundle.crt file has been created");
  } catch (error: any) {
    logger.error(error);
  }
};

main();
