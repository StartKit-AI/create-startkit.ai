#!/usr/bin/env node

import chalk from "chalk";
import { execSync } from "child_process";
import figlet from "figlet";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import { randomBytes } from "crypto";
import signale from "signale";

const logger = new signale.Signale({
  logLevel: "info",
});

logger.log(
  chalk.blue(figlet.textSync("StartKit.AI", { horizontalLayout: "full" }))
);

let repoType = process.argv[2] || "growth";
let projectName = "./my-ai-project";
if (!["growth", "starter"].includes(process.argv[2])) {
  repoType = "growth";
  projectName = process.argv[2] || projectName;
} else {
  projectName = process.argv[3] || projectName;
}

const repos = {
  growth: "git@github.com:startkit-ai/startkit.ai.git",
  starter: "git@github.com:startkit-ai/startkit.ai.git",
};
const access = getRepoAccess();
if (!access.growth && !access.starter) {
  logger.error(
    `\n❌ It looks like you don't have access to the StartKit.AI repo, you need to purchase access from https://startkit.ai.`
  );
  process.exit(1);
}
let repo;
if (repoType) {
  repo = repos[repoType];
} else if (access.growth) {
  repo = repos.growth;
} else if (access.starter) {
  repo = repos.starter;
}

if (fs.existsSync(projectName)) {
  logger.error(`Project directory "${projectName}" already exists.`);
  process.exit(1);
}

let interactives = [];
logger.interactive = (interactiveScope) => {
  if (!interactives[interactiveScope]) {
    interactives[interactiveScope] = new signale.Signale({
      interactive: true,
    });
  }
  return interactives[interactiveScope];
};

const modules = [
  "Chat",
  "Image Generation",
  "Text-to-Speech",
  "Speech-to-Text",
  "Translation",
  "Moderation",
  "AI Detection",
];

logger.info("\n🤖 Welcome to StartKit.AI, let's get started!\n");

inquirer
  .prompt([
    {
      type: "input",
      name: "projectName",
      message: `Where should we create your new project?\n`,
      required: true,
      default: projectName,
      prefix: `\n${chalk.green("?")}`,
    },
    // {
    //   name: "modules",
    //   type: "checkbox",
    //   message: `What modules will your project use?\n`,
    //   required: true,
    //   choices: modules,
    //   default: modules.slice(0, 5),
    //   prefix: `\n${chalk.green("?")}`,
    // },
    {
      name: "openApiKey",
      type: "input",
      message: `Now lets set up some default values for your new project! Enter your OpenAI API key:\n`,
      required: true,
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "input",
      name: "mongoUri",
      message: "Enter your MongoDB connection string:\n",
      required: true,
      prefix: `\n${chalk.green("?")}`,
    },
    {
      name: "enableStorage",
      type: "list",
      message: `Do you want to set up S3 storage? This will let your product store images generated, or any user uploads. You can find more info here: https://startkit.ai/docs/getting-started/installation/s3\n`,
      required: true,
      choices: ["Yes", "No"],
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "input",
      name: "storageName",
      message: "Enter storage name:\n",
      when: (a) => {
        return a.enableStorage === "Yes";
      },
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "input",
      name: "storageRegion",
      message: "Enter storage region:\n",
      when: (a) => {
        return a.enableStorage === "Yes";
      },
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "input",
      name: "storageUrl",
      message: "Enter storage URL:\n",
      when: (a) => {
        return a.enableStorage === "Yes";
      },
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "input",
      name: "storageKey",
      message: "Enter storage key:\n",
      when: (a) => {
        return a.enableStorage === "Yes";
      },
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "input",
      name: "storageSecret",
      message: "Enter storage secret:\n",
      when: (a) => {
        return a.enableStorage === "Yes";
      },
      prefix: `\n${chalk.green("?")}`,
    },
    {
      name: "enablePinecone",
      type: "list",
      message: `Do you want to set up Pinecone? This will let your product do RAG, where it saves data that it can use alongside Chat endpoints. More info here: https://startkit.ai/docs/getting-started/installation/pinecone'\n`,
      required: true,
      choices: ["Yes", "No"],
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "input",
      name: "pineconeApiKey",
      message: "Enter your Pinecone API key:\n",
      when: (a) => {
        return a.enablePinecone === "Yes";
      },
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "input",
      name: "pineconeIndexHost",
      message: "Enter your Pinecone Index Host:\n",
      when: (a) => {
        return a.enablePinecone === "Yes";
      },
      prefix: `\n${chalk.green("?")}`,
    },
    {
      type: "list",
      name: "start",
      message:
        "Do you want to run StartKit.AI now? (Or you can do this later by running `yarn dev`)\n",
      choices: ["Yes", "No"],
      prefix: `\n${chalk.green("?")}`,
    },
  ])
  .then(runAnswers)
  .catch(console.error);

// Get the project name from the user
async function runAnswers(answers) {
  logger.log();
  logger.interactive("2").await("Setting up StartKit.AI\n\n");
  const projectName = answers.projectName;
  const projectPath = path.join(process.cwd(), projectName);

  await sleep();
  cloneRepo(projectPath);
  logger.interactive("2").await(`Installing dependencies`);

  execSync(`yarn`, { cwd: projectPath, stdio: "ignore" });
  logger.interactive("2").success(`Dependencies installed`);
  await createEnv(answers, { projectPath });

  if (answers.start === "Yes") {
    logger.interactive("4").await(`Running StartKit.AI`);
    try {
      execSync("node index.js --open", { cwd: projectPath, stdio: "inherit" });
    } catch (error) {
      console.error("Error executing command:", error.message);
    }
  }
}

function cloneRepo(projectPath) {
  logger.interactive("1").await(`Cloning StartKit.AI repo into ${projectPath}`);
  execSync(`git clone --recurse-submodules ${repo} ${projectPath}`, {
    stdio: "ignore",
  });
  execSync(`cd ${projectPath} && git remote add startkit ${repo}`);
  logger
    .interactive("1")
    .success(`Cloned StartKit.AI repo into ${projectPath}`);
}

async function generateSecret() {
  return randomBytes(32).toString("hex");
}

async function createEnv(answers, { projectPath }) {
  const envPath = path.join(projectPath, ".env");
  const envExamplePath = path.join(projectPath, ".env.example");

  let output = [];
  output.push({ key: "MONGO_URI", value: answers.mongoUri });
  output.push({ key: "STORAGE_NAME", value: answers.storageName });
  output.push({ key: "STORAGE_REGION", value: answers.storageRegion });
  output.push({ key: "STORAGE_URL", value: answers.storageUrl });
  output.push({ key: "STORAGE_KEY", value: answers.storageKey });
  output.push({ key: "STORAGE_SECRET", value: answers.storageSecret });
  output.push({ key: "PINECONE_API_KEY", value: answers.pineconeApiKey });
  output.push({ key: "PINECONE_INDEX_HOST", value: answers.pineconeIndexHost });
  output.push({ key: "OPENAI_KEY", value: answers.openAiKey });

  try {
    fs.writeFileSync(envPath, "", { flag: "wx" });
    const lines = fs.readFileSync(envExamplePath, "utf-8");
    const linesArray = lines.split("\n");

    for (let line of linesArray) {
      if (line.startsWith("#") || line.trim() === "") {
        fs.appendFileSync(envPath, line + "\n");
      } else {
        let [key, value] = line.split("=");
        switch (key) {
          case "EMBEDDINGS_BEARER_TOKEN":
            value = await generateSecret();
            break;
          case "JWT_SECRET":
            value = await generateSecret();
            break;
          default: {
            break;
          }
        }

        fs.appendFileSync(envPath, `${key}=${value}\n`);
      }
    }
    logger.log();
    await sleep();
    logger.success(".env file has been successfully created.");
    await sleep();
    logger.success("Setup complete!");
  } catch (error) {
    console.error("Failed to create .env file:", error);
  }
}

async function sleep() {
  return await new Promise((resolve) => setTimeout(resolve, 1000));
}

function getRepoAccess() {
  let canAccessGrowth = false;
  let canAccessStarter = false;
  try {
    execSync(`git ls-remote ${repos.growth}`);
    canAccessGrowth = true;
  } catch (e) {}
  try {
    execSync(`git ls-remote ${repos.starter}`);
    canAccessStarter = true;
  } catch (e) {}

  return {
    growth: canAccessGrowth,
    starter: canAccessStarter,
  };
}
