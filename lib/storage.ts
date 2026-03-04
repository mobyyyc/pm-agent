import { promises as fs } from "fs";
import path from "path";

import { projectSchema, taskSchema, type Project, type Task } from "@/types/models";

const dataDir = path.join(process.cwd(), "data");
const companyFile = path.join(dataDir, "company.json");
const projectsFile = path.join(dataDir, "projects.json");
const tasksFile = path.join(dataDir, "tasks.json");

async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true });

  const initialFiles: Array<{ file: string; initialValue: unknown }> = [
    { file: companyFile, initialValue: { name: "Demo Company", values: [], constraints: [] } },
    { file: projectsFile, initialValue: [] },
    { file: tasksFile, initialValue: [] },
  ];

  await Promise.all(
    initialFiles.map(async ({ file, initialValue }) => {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify(initialValue, null, 2), "utf-8");
      }
    }),
  );
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  await ensureDataFiles();
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data) as T;
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDataFiles();
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

export async function readCompanyKnowledge(): Promise<unknown> {
  return readJsonFile<unknown>(companyFile);
}

export async function getProjects(): Promise<Project[]> {
  const projects = await readJsonFile<unknown[]>(projectsFile);
  return projects.map((item) => projectSchema.parse(item));
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await writeJsonFile(projectsFile, projects);
}

export async function getTasks(): Promise<Task[]> {
  const tasks = await readJsonFile<unknown[]>(tasksFile);
  return tasks.map((item) => taskSchema.parse(item));
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await writeJsonFile(tasksFile, tasks);
}
