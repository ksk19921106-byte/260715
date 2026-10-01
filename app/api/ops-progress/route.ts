import { mkdir, readFile, readdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedPortalUser, unauthorized, forbidden } from "../../services/authServer";
import { isLiveAuthEnabled } from "../../services/authMode";
import { getOperationsScope, SALES_STAFF, SALES_LEADERS } from "../../services/organization";
import { isSharedStorageConfigured, requestOpsProgress } from "../../services/sharedStorageServer";
import { progressCycle, progressTasks, validProgressDate, type ProgressRecord } from "../../services/opsProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const directory = path.join(process.cwd(), "data", "ops-progress");

async function viewer(request: Request) {
  const user = await getAuthenticatedPortalUser();
  if (isLiveAuthEnabled()) return user;
  const name = new URL(request.url).searchParams.get("viewer") || "";
  if (["Sally", "Gavin", "Vincent"].includes(name)) return { name, salesName: name, team: "VIPS팀", role: "VIPS" as const, accessRole: "admin" as const };
  const person = SALES_STAFF.find((item) => item.name === name);
  const leader = SALES_LEADERS.find((item) => item.name === name);
  return person || leader ? { name, salesName: name, team: person?.team || "Sales본부", role: "SALES" as const, accessRole: leader ? "manager" as const : "sales" as const } : null;
}

export async function GET(request: Request) {
  const user = await viewer(request);
  if (!user) return unauthorized();
  const scope = getOperationsScope(user);
  if (!scope.canViewOperations) return forbidden();
  const date = new URL(request.url).searchParams.get("date") || "";
  if (!validProgressDate(date)) return NextResponse.json({ message: "날짜가 올바르지 않습니다." }, { status: 400 });
  const cycle = progressCycle(date);
  const subjects = [...scope.memberNames, ...(user.role === "VIPS" ? ["VIPS"] : [])];
  try {
    let records: ProgressRecord[];
    if (isSharedStorageConfigured()) {
      const data = await requestOpsProgress<ProgressRecord[]>({ action: "getOpsProgress", cycle, subjects });
      if (!Array.isArray(data)) throw new Error("공용 저장소 일정 점검 기능을 업데이트해주세요.");
      records = data;
    } else {
      if (process.env.VERCEL) throw new Error("공용 저장소 URL을 설정해주세요.");
      const files = await readdir(directory).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; });
      records = await Promise.all(files.filter((file) => file.startsWith(cycle) && file.endsWith(".json")).map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8")) as ProgressRecord));
    }
    return NextResponse.json({ records: records.filter((item) => item.cycle === cycle && subjects.includes(item.subject)), storage: isSharedStorageConfigured() ? "shared" : "local" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "점검 상태를 불러오지 못했습니다." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const user = await viewer(request);
  if (!user) return unauthorized();
  const scope = getOperationsScope(user);
  if (!scope.canViewOperations) return forbidden();
  const data = await request.json().catch(() => null) as Partial<ProgressRecord> | null;
  if (!data || typeof data.date !== "string" || !validProgressDate(data.date)
    || !["complete", "in_progress", "incomplete", "auto"].includes(data.status || "")
    || !Array.isArray(data.evidence) || data.evidence.length > 10000
    || data.evidence.some((item) => typeof item !== "string" || item.length > 2000)) {
    return NextResponse.json({ message: "점검 값이 올바르지 않습니다." }, { status: 400 });
  }
  const task = progressTasks(data.date, user.role === "VIPS").find((item) => item.id === data.task);
  if (!task) return NextResponse.json({ message: "해당 날짜의 일정이 아닙니다." }, { status: 400 });
  if (task.audience === "vips" ? user.role !== "VIPS" || data.subject !== "VIPS" : !scope.memberNames.includes(data.subject || "")) return forbidden();
  const record: ProgressRecord = {
    cycle: progressCycle(data.date), date: data.date, task: task.id, subject: data.subject!,
    status: data.status!, evidence: data.evidence, updatedBy: user.name, updatedAt: new Date().toISOString()
  };
  try {
    if (isSharedStorageConfigured()) {
      await requestOpsProgress({ action: "saveOpsProgress", record });
    } else {
      if (process.env.VERCEL) throw new Error("공용 저장소 URL을 설정해주세요.");
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, `${record.cycle}-${record.date}-${record.task}-${record.subject}.json`);
      const temp = `${file}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(record), "utf8");
      await rename(temp, file);
    }
    return NextResponse.json({ record, storage: isSharedStorageConfigured() ? "shared" : "local" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "저장하지 못했습니다." }, { status: 503 });
  }
}
